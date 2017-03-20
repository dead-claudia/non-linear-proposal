# Non-linear Control Flow

Asynchrony is hard. Modeling it is not super intuitive in most languages, JavaScript being no exception for the longest time. But we have been making progress:

1. Callbacks give us the base concept, thanks to lambda calculus.

    - One-time callbacks let us handle linear steps.
    - Event callbacks let us handle non-linear steps.

    The older DOM APIs and Node's original APIs were both initially built using this concept. Caolan McMahon's Async became very popular for this world, as it provided the glue we needed to model the steps and logic.

2. Monadic abstractions help us model them as units:

    - Promise chains let us model linear steps.
    - Observables and Promise combinators let us model non-linear steps.

    Node's streams, WHATWG's streams, and `fetch` were initially built using this concept. Bluebird and RxJS gained a lot of popularity for this, because they provided a lot of useful glue methods for modeling the logic. The Async library started declining in popularity because it was no longer needed - the steps were easily modeled.

3. Procedural abstractions give us the ability to express the logic within the model:

    - Async functions let us express the logic for linear steps.
    - Nothing yet exists to let us express the logic for non-linear steps.

    So far, this is new enough that very few utilities have been created. But the utilities will inevitably be smaller, because both the steps and logic are easily modeled via syntax. Recently, promise libraries have seen a downward trend in favor of async functions.

Now, we need to catch up with expressing our non-linear logic. [This is way too many operators](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html), but there's a similar scenario going on with [Bluebird](http://bluebirdjs.com/docs/api-reference.html), [Async](https://caolan.github.io/async/), and [Lodash](https://lodash.com/docs), each providing additional operators to describe high-level modeling and control flow because JavaScript didn't have proper language support at the time.

## Investigation

If we were to go the route of iterators, that works very well for sequential steps, but that provides no facilities for non-sequential logic inherent with event handling, etc. In particular, async functions currently provide no way to express parallelism that normal functions don't already allow. Here are a couple past ideas I've seen multiple times in es-discuss, for syntactically joining Promises:

```js
// The first two are equivalent
let [...results] = await* promises
let [...results] = await.all promises
let [...results] = await.race promises
```

Those give syntactic help with Promises, but we have two issues:

- It doesn't provide *any* benefit over `Promise.all` or `Promise.race`. If you have to iterate them, you still have to do `await.all promises.map(async value => { ... })`, which is wasteful and boilerplatey for that common parallelism case.
- It's too specific to singular Promises, leaving no room for observation.
- Because of the endless stream of proposals (get it?), TC39 and several others have raised the bar greatly for new syntax additions, and [Mark S. Miller summarized it very nicely](https://esdiscuss.org/topic/the-tragedy-of-the-common-lisp-or-why-large-languages-explode-was-revive-let-blocks) this frustration. It usually takes something truly transformative to meet that bar. Here's a few examples:

    - Async functions/iterators transformed the way people view async code, so it was quickly accepted.
    - [`do` expressions](https://gist.github.com/dherman/1c97dfb25179fa34a41b5fff040f9879) make it easier to work in small-scale work (like avoiding nested ternaries), so it was accepted, but with some initial debate.
    - [Function bind syntax](https://github.com/tc39/proposal-bind-operator) is a combination of function pipelining and special `Function.prototype.bind` syntax sugar, but the latter struggled to get accepted because the sugar didn't really enable much.

    Such a minimal proposal like `await.all` would struggle to reach consensus at all.

Now, what about Observables? Should we give a syntactic assist for them? One big difficulty is that their logic is inherently non-linear - [reactive programming](https://en.wikipedia.org/wiki/Reactive_programming) isn't even *mildly* von-Neumann. For similar reasons, you have to address some very unique issues with Observables:

- There are two different ways of joining them: concatenation and merging.
- You receive values on *their* request, so the time you receive them is not your decision.
- Their non-linear nature means you can't iterate them normally like you can with arrays.

So unlike Promises, you have a much higher level of inherent parallelism and non-determinism with Observables, requiring a far more flexible feature set to do anything useful. They seem to be a suitable way of handling things, because they're made for non-linear handling. But, that still has its complications due to the 3 separate, independent channels. Additionally, it integrates almost zero percent with Promises.

Conversely, async iterators are focused on sequential iteration. It's currently inherently sequential for the same reasons generators are sequential. But `await` is merely a sequential delimiter, and if you allow non-sequential awaits, you can easily fix that.

## Proposal

So here's my proposal:

- Create ways to join multiple non-blocking async expressions, without introducing new types.
- Create ways to iterate sequences without blocking the next iteration.
- Create ways to yield values non-sequentially from async generators.

My goal is to enable reactive, declarative, procedural handling of async data without much syntax, and to ensure it's easy to learn. It should not involve constantly looking up methods just to ensure you're using the right one.

This should make it much easier to write pipelines and understand the flow of data, so it's more intuitive and easier to maintain. [This gist](https://gist.github.com/isiahmeadows/81c48a8fa458ef5832d065292ccd1f47) shows the difference I mean, from the old callbacks to the current observable libraries to this proposal.

This may seem complex initially. And yes, it involves new syntax. But here's why I feel the new syntax is warranted:

1. This table needs filled out:

    |                  |       Sync        |      Async        |
    |------------------|-------------------|-------------------|
    | Single Push/Pull | Normal functions  | Async functions   |
    | Multi Push/Pull  | Normal generators | Async generators  |

    And here's where each part fits into the picture:

    - Single Push: math, API requests
    - Single Pull: resource management
    - Multi Push: UI event handlers, server loops
    - Multi Pull: requested data streams, polling

2. Drastically reduced dependency tree and somewhat smaller bundles. Even with a Babel transpilation to a generator, it could be smaller than including RxJS 5, because you don't need most of the operators.

3. Very large areas for engine optimization:

    - Explicit flow control.
    - Engines can optimize non-sequential operations with minimal overhead, since they can quickly syntactically analyze it.
    - Can be compiled down to a highly efficient state machine similar to async functions.
    - `await all` and `await race` below can elide the intermediary promise, and only store what is used.
    - The loop closure can have its calling sequence very highly optimized - it only needs a closure/argument pair for arguments, and it returns an optional completion value.

### Syntax

Here's what I imagine the syntax would be like for better non-linear asynchrony support:

- Iteration:

    **`for all`, `for await all`:**

    Similar to `await Promise.all(list.map(async item => { ... }))`, but avoids the intermediary allocation, and includes an async iterator variant.

    ```js
    for all (const item of iterator) { /* ... */ }
    for await all (const item of iterator) { /* ... */ }
    ```

    This iterates the collection without blocking the next iteration, and includes the normal loop flow control. Inner `yield` and `yield*` expressions work from the parent's scope.

    Completions (i.e. `return`, `throw`, and `break`), when given, require special semantics, though:

    1. Invoke and await `iterator.return()` if it exists.
    2. Dereference the most recent `iterator.next()`.
    3. Await all remaining iterations.
    4. Return completion from loop.

- Merging:

    **`await all`:**

    Run all of the following at once, and return an array of the respective return values, much like `Promise.all`, but with much less allocation and indirection. If any fails, unsubscribe them as applicable, and immediately throw the sent error. No deferral of completion is done beyond that of the particular production (e.g. with `await`). Here are the allowed productions inside:

    ```js
    const [...results] = await all {
        // Any async context, returns `undefined` (similar to above).
        for all (const item of iterator) { /* ... */ }
        for await all (const item of iterator) { /* ... */ }

        // Any async context, returns the resolved value/array.
        await thenable
        await all { /* ... */ }
        await race { /* ... */ }
    }
    ```

    Note that thrown errors are handled appropriately, and inner `yield` and `yield*` work as you would expect.

    - An implementation might avoid creating any promise altogether, and just allocate a simple context with the results + resulting entries (if used), updating that as microtasks finish, and then handling the values as appropriate.

    **`await race`:**

    Run all of the following at once, and return the first value to successfully complete, much like `Promise.race`, but with much less allocation and indirection. If any fails, unsubscribe the as appropriate, and immediately throw the error. The same productions inside `await all { ... }` are also allowed inside `await race`.

    ```js
    const result = await race {
        // ...
    }
    ```

    Note that thrown errors are handled appropriately, and inner `yield` and `yield*` work as you would expect.

    - An implementation might avoid creating any promise altogether, and just returning the value as if from a direct `await`.

- In async generators, when `yield` is called without a `iterator.next()` to pull the data, it's transparently queued so the data is not lost. Each `yield` blocks its local context until the following call to `iterator.next()`, but it does not block the next `for all` iteration or other productions within `await all`.

    To clarify what I'm trying to say (it's admittedly difficult to explain in prose), consider this example:

    ```js
    async function *immediate(iter) {
        console.log("enter immediate")

        for all (const item of iter) {
            console.log(`start ${item}`)
            yield item
            console.log(`end ${item}`)
        }

        console.log("leave immediate")
    }

    ;(async () => {
        const iter = immediate([1, 2, 3])
        await iter.next().then(i => console.log(`yield ${i}`))
        await iter.next().then(i => console.log(`yield ${i}`))
        await iter.next().then(i => console.log(`yield ${i}`))
        await iter.next()
    })()
    ```

    This would log to the console the following:

    ```
    enter immediate
    start 1
    start 2
    start 3
    yield 1
    end 1
    yield 2
    end 2
    yield 3
    end 3
    leave immediate
    ```

This was designed for potential future extension like for `any` if `Promise.any` is added.

### Observables

I also propose that, in the [eventual Observable proposal](https://github.com/tc39/proposal-observable), two things be added:

- `Observable.prototype.unbuffered()`

    This instance method accepts no arguments, and returns an unbuffered async iterator that returns the last value sent. If no item is waiting, the promise's resolution is enqueued until another value arrives, and items are only held for a single `next` call. It returns native promises only, so engines can internalize most of it.

- `Observable.prototype.buffered()`

    This instance method accepts no arguments, and returns a buffered async iterator that stores values in a queue as they're sent, returning them in sequence from `next`. It returns native promises only, so engines can internalize most of it.

It's still an [active discussion](https://github.com/tc39/proposal-observable/issues/111) which is the more sensible default, and both are equally essential, so I've intentionally omitted a recommendation for `Observable.prototype[Symbol.asyncIterator]`.

## Potential questions

In anticipation of some questions, I decided to put together this section.

### Why not observables? Aren't you effectively recreating them?

Not exactly. In fact, I'm actually taking a different approach entirely: by enabling locally non-blocking operations, I'm enabling iterators to serve much like event streams.

Observables have other existing issues among them:

- They struggle to interoperate with promises natively, and require special wrappers to do anything with them.
- They are too specific to push-only data that they fail to be useful in other areas.

### Why so much new syntax?

First, I did try to reduce the amount of new syntax involved. It's super difficult when building from nothing to something fully featured. Imagine trying to design a nice, usable iteration syntax for a language that previously only had if/else and gotos. That's where I'm coming from, because JavaScript has literally zero syntax support for non-determinism, despite having being designed from the start to script a heavily non-deterministic environment (web browsers) and mostly being used in such non-deterministic environments.

And to add insult to injury, very few general-purpose languages actually have any decent support for handling reactive non-linear control flow at a logical level (Haskell via library support, Erlang natively, a few DSLs, and a few research languages, mostly older), with most others instead preferring to shove it under the rug and pretend it's not there. So I had very few resources to look to.

In particular, I did reduce the syntax and scope dramatically by limiting it to just promises and async iterators.

### For observation, this is *way* too allocatey...

As [this idea fell out](https://github.com/tc39/proposal-observable/issues/129), yes, there is that risk with high-frequency events like `mousemove`, but there are mitigations.

One benefit is that because events are always sent asynchronously, you won't be blocking the UI with the processing, even if it is slightly slower. Also, the proposed Observable additions are easily lowered to fast native code, because they only invoke two potential user functions, `observable.subscribe` on the instance and `subscription.unsubscribe` on the returned subscription.

Engines can already avoid most in-loop allocation in general by detecting `%AsyncGeneratorPrototype%.next` calls (and a few others as necessary) to avoid creating the resulting promise entirely. Such an optimization would also benefit this proposal greatly.

### Why `await all` and `await race`? Won't that conflict?

I also chose the names to emphasize the fact something is being awaited. And no, they won't conflict provided you require no line terminator before the opening brace.

### Why `for all` and not `for race`?

I'm willing to add that if there is sufficient need, but it's not a common use case to do `Promise.race(promises.map(value => { ... }))`.

### Why both `for all` and `for await all`?

One is for sync iterators, the other for async iterators. See [this issue](https://github.com/tc39/proposal-async-iteration/issues/12) for more details on why I chose to not unify them.

### Why throw away all the purity of observable operators?

Yes, I get the benefits of functional purity. It's harder to screw up mutable state when you don't have any. You can still enforce it here, too. Just keep in mind that it makes the mutations you'll inevitably have to deal with (like with the operators `reduce` and `throttle`) that much clearer, where it was hidden behind the scenes before. Also, even Haskell can't escape its `IO` monad.

### I like my operator methods! They're way better than this explicit control flow!

There is no requirement that you *must* use this. Heck, people are still using Lodash and Bluebird when the native equivalents are perfectly adequate for most use cases.

### I don't like this at all!

An explanation would be very helpful here...

### Ughwehhfcnasellkf!

I don't know. Please try English, so I can understand you.

### This proposal is too long!

I'm surprised you got this far! :wink:
