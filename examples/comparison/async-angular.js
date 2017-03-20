// Non-blocking async iterators + Angular 1
function searchWikipedia(term) {
    return $http({
        url: "http://en.wikipedia.org/w/api.php?&callback=JSON_CALLBACK",
        method: "jsonp",
        params: {
            action: "opensearch",
            search: encodeURI(term),
            format: "json"
        }
    })
}

;(async () => {
    const ready = throttle(1000)
    let last
    for await all (let value of observeOnScope($scope, "search")) {
        if (!ready()) continue
        value = value || ""
        if (value !== last) {
            last = value
            const result = await searchWikipedia(value)
            if (!safeApply($scope, () => $scope.data = result)) break
        }
    }
})()

// Utilities for above
function throttle(delay) {
    let date = 0
    return () => {
        const current = Date.now()
        if (current < date) return false
        date = current + delay
        return true
    }
}

function safeApply($scope, func) {
    if ($scope.$$destroyed) return false
    if ($scope.$$phase || $scope.$root.$$phase) {
        func()
    } else {
        $scope.apply(() => { func() })
    }
    return true
}

async function *observeOnScope($scope, expr) {
    const resolves = []
    const values = []
    const sub = $scope.$watch(expr, value => {
        if (resolves.length) resolves.pop()(value)
        else values.push(value)
    })
    
    try {
        while (true) {
            if (values.length) yield values.pop()
            else yield new Promise(r => { resolves.push(r) })
        }
    } finally {
        sub.unsubscribe()
    }
}
