// Non-blocking async iterators

function randInt(range) {
    return Math.random() * range | 0
}

async function *getSuggestions(selector) {
    yield undefined

    const response = await fetch(`https://api.github.com/users?since=${randInt(500)}`)
    const listUsers = await response.json()
    let current = listUsers[randInt(listUsers.length)]

    yield current

    // In stream generators, only literal `await value` expressions are deferred.
    await all {
        for await all (const _ of fromEvent(document.querySelector(".refresh"), "click")) {
            yield current = undefined
            const response = await fetch(`https://api.github.com/users?since=${randInt(500)}`)
            const listUsers = await response.json()
            yield current = listUsers[randInt(listUsers.length)]
        }

        for await all (const _ of fromEvent(document.querySelector(selector), 'click')) {
            yield current
        }
    }
}

;(async () => {
    for all (const selector of [".close1", ".close2", ".close3"]) {
        for await all (const suggestion of getSuggestions(selector)) {
            if (suggestion == null) {
                // hide the first suggestion DOM element
            } else {
                // show the first suggestion DOM element and render the data
            }
        }
    }
})()

// Helper
async function *fromEvent(elem, name) {
    const resolves = []
    const values = []
    function listener(e) {
        if (resolves.length) resolves.pop()(e)
        else values.push(e)
    }

    elem.addEventListener(name, listener, false)

    try {
        while (true) {
            if (values.length) yield values.pop()
            else yield new Promise(r => { resolves.push(r) })
        }
    } finally {
        elem.removeEventListener(name, listener, false)
    }
}
