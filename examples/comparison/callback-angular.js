// Callbacks + Angular 1
function searchWikipedia(term, next) {
    return $http({
        url: "http://en.wikipedia.org/w/api.php?&callback=JSON_CALLBACK",
        method: "jsonp",
        params: {
            action: "opensearch",
            search: encodeURI(term),
            format: "json"
        }
    })
    .then(next)
}

var last
var sub = $scope.$watch(expr, throttle(function (value) {
    value = value || ""
    if (value !== last) {
        last = value
        searchWikipedia(value, safeApply($scope, sub, function (result) {
            $scope.data = result
        }))
    }
}))

// Utilities for above
function throttle(delay, func) {
    let date = 0
    return function () {
        const current = Date.now()
        if (current < date) return
        date = current + delay
        func.apply(this, arguments)
    }
}

function safeApply($scope, sub, func) {
    return function (value) {
        if ($scope.$$destroyed) {
            sub.unsubscribe()
        } else if ($scope.$$phase || $scope.$root.$$phase) {
            func(value)
        } else {
            $scope.apply(function () { func(value) })
        }
    }
}
