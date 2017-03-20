// RxJS Observables
import {Observable} from "rxjs"

function randInt(range) {
    return Math.random() * range | 0
}

function getSuggestions(selector) {
    const refreshElem = document.querySelector(".refresh")
    const baseElem = document.querySelector(selector)

    const refreshClickStream = Rx.Observable.fromEvent(refreshElem, "click")

    const responseStream = refreshClickStream.startWith()
        .map(() => `https://api.github.com/users?since=${randInt(500)}`)
        .flatMap(url => Rx.Observable.fromPromise(
            window.fetch(url).then(response => response.json())
        ))
        .map(() => listUsers[randInt(listUsers.length)])

    return Rx.Observable.fromEvent(baseElem, "click")
    .startWith(undefined)
    .combineLatest(responseStream, (_, listUsers) => listUsers)
    .merge(refreshClickStream.map(() => undefined).startWith(undefined))
    .map(suggestion => ({selector, suggestion}))
}

Rx.Observable.of(".close1", ".close2", ".close3")
.flatMap(selector => getSuggestions(selector))
.subscribe(({selector, suggestion}) => {
    if (suggestion == null) {
        // hide the selector's suggestion DOM element
    } else {
        // show the selector's suggestion DOM element and render the data
    }
})
