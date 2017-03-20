// Callbacks + jQuery
function randInt(range) {
    return Math.random() * range | 0
}

function getSuggestions(selector, send) {
    send(undefined)

    function getUsers(next) {
        $.ajax({url: "https://api.github.com/users?since=" + randInt(500)})
        .fail(function (e) { console.error(e) })
        .done(function (listUsers) { next(listUsers) })
    }

    getUsers(function (listUsers) {
        var current = listUsers[randInt(listUsers.length)]
        send(current)

        $(".refresh").click(function () {
            current = undefined
            send(undefined)

            getUsers(function (listUsers) {
                current = listUsers[randInt(listUsers.length)]
                send(current)
            })
        })

        $(selector).click(function () {
            send(current)
        })
    })
}

;[".close1", ".close2", ".close3"].forEach(function (selector) {
    getSuggestions(selector, function (suggestion) {
        if (suggestion == null) {
            // hide the first suggestion DOM element
        } else {
            // show the first suggestion DOM element and render the data
        }
    })
})
