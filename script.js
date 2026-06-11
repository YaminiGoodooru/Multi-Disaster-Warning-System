const BACKEND_URL=
"https://multi-disaster-warning-system-zcga.onrender.com";

function showPage(id){

document

.querySelectorAll(

".page"

)

.forEach(

page=>{

page.classList.remove(

"active"

)

}

)

document

.getElementById(

id

)

.classList.add(

"active"

)

window.scrollTo(

0,

0

)

}

document

.getElementById(

"form"

)

.addEventListener(

"submit",

async function(e){

e.preventDefault()

const name=

document

.querySelector(

'input[placeholder="Name"]'

)

.value

.trim()

const location=

document

.querySelector(

'input[placeholder="Location"]'

)

.value

.trim()

const phone=

document

.getElementById(

"phone"

)

.value

.trim()

const email=

document

.querySelector(

'input[type="email"]'

)

.value

.trim()

const latitude=

document

.getElementById(

"latitude"

)

.value

.trim()

const longitude=

document

.getElementById(

"longitude"

)

.value

.trim()

if(

name===""

||

location===""

||

phone===""

||

email===""

||

latitude===""

||

longitude===""

){

alert(

"Please fill all fields"

)

return

}

const phonePattern=

/^[0-9]{10}$/

if(

!phonePattern.test(

phone

)

){

alert(

"Phone number must contain exactly 10 digits"

)

return

}

const emailPattern=

/^[^\s@]+@[^\s@]+\.[^\s@]+$/

if(

!emailPattern.test(

email

)

){

alert(

"Enter valid Gmail"

)

return

}

if(

latitude<-90

||

latitude>90

){

alert(

"Latitude must be between -90 and 90"

)

return

}

if(

longitude<-180

||

longitude>180

){

alert(

"Longitude must be between -180 and 180"

)

return

}

const userData={

name:name,

phone:phone,

email:email,

location:location,

latitude:

parseFloat(latitude),

longitude:

parseFloat(longitude)

}

try{

const response=

await fetch(

`${BACKEND_URL}/add-user`,

{

method:"POST",

headers:{

"Content-Type":

"application/json"

},

body:

JSON.stringify(

userData

)

}

)

if(

response.ok

){

alert(

"Registration Successful"

)

document

.getElementById(

"form"

)

.reset()

showPage(

"about"

)

}

else{

const error=

await response.text()

alert(

"Registration Failed\n"+error

)

}

}

catch(err){

console.log(

err

)

alert(

"Cannot connect to backend server"

)

}

}

)