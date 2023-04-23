const username = document.querySelector("input[name='username']")
const password = document.querySelector("input[name='password']")
const submit   = document.querySelector("#submit")

let validUsername = false
let validPassword = false

function handleValidity() {
	if (validUsername && validPassword) {
		submit.classList.add("valid")
	} else {
		submit.classList.remove("valid")
	}
}

username.onkeyup = () => {
	validUsername = username.value.length != 0
	handleValidity()
}

password.onkeyup = () => {
	validPassword = password.value.length != 0
	handleValidity()
}
