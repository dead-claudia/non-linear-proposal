// RxJS Observables + Angular 1
import {Observable} from "rxjs"

function searchWikipedia(term) {
    return Observable.fromPromise($http({
        url: "http://en.wikipedia.org/w/api.php?&callback=JSON_CALLBACK",
        method: "jsonp",
        params: {
            action: "opensearch",
            search: encodeURI(term),
            format: "json"
        }
    }))
}

safeApply(
    $scope,
    observeOnScope($scope, "search")
    .throttle(1000)
    .map(value => value || "")
    .distinctUntilChanged()
    .flatMapLatest(searchWikipedia)
    result => { $scope.data = result }
).subscribe()

// Utilities for above
function safeApply($scope, stream, func) {
    return stream
    .takeWhile(() => !$scope.$$destroyed)
    .tap(data => {
        if ($scope.$$phase || $scope.$root.$$phase) {
            func(data)
        } else {
            $scope.apply(() => { func(data) })
        }
    })
}

function observeOnScope($scope, expr) {
    return new Observable(observer => {
        return $scope.$watch(expr, value => observer.next(value))
    })
}
