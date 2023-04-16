const crypto = require("crypto");
const locallydb = require("locallydb")
const db = new locallydb("./mydb")
const users = db.collection("users")
if(users.items.length === 0) {
  // no users? first run probably, let's addd a default account
  users.insert({
    user: "chuck",
    password: sha256("password"),
    admin: true,
  });
}

/* helper function to get a username/password tuple from request headers.
 * Returns an empty array if no authorization header is present
 */
const parseBasic = (req) => {
  if(req.headers.authorization) {
    // split the value of the header "Basic lwjkjvljk"
    const [ _, value ] = req.headers.authorization.split(" ")
    // decode base64 string into binary values in a buffer
    const buff = Buffer.from(value, 'base64')
    // convert the buffer into string and split user:pass
    return buff.toString().split(":")
  }
  return []
}

/* simple encapsulation of responding with Basic authentication request */
const promptForAuth = (res) => {
  res.writeHead(401, {
    "WWW-Authenticate": "Basic"
  })
  res.end()
}

/* helper function to produce a hash of some string */
const sha256 = (content) => crypto.createHash("sha256")
   .update(content).digest("hex");

/* our authentication mechanism proper. returns username if the request contains the Basic
 * authorization header containg a username and password found in users. Otherwise it
 * prompts for a username and password by sending the appropriate headers and response code
 * to the browser and returns false
 */
const authenticate = (req, res) => {
  const [user, pass] = parseBasic(req)
  if(user && pass && 
      users.where({ user, password: sha256(pass) }).items.length > 0) {
    return user
  }
  promptForAuth(res)
  return false
}

const { handleDelete, getBody } = require("./httpHelpers")
const userController = (req, res) => {
  const user = authenticate(req,res)
  // checking for authentication and authorization
  if(user && users.where({ user }).items[0].admin) {
    if(req.method === "POST") {
      getBody(req).then(body => {
        users.insert({
          user: body.user,
          password: body.pass,
          admin: !!body.admin
        })
        users.save()
        // redirect to the admin page, since we're not ajaxing this
        res.writeHead(301, {
          Location: "/admin.html"
        })
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    } else if(req.method === "PUT") {
      getBody(req).then(body => {
        const match = req.url.match(/\/api\/users\/(\d+)/)
        if(match && match[1]) {
          // if no password provided, use existing one
          const password = body.pass ? sha256(body.pass) : undefined
          // save the user
          users.update(match[1]*1, {
            user: body.user,
            password,
            admin: !!body.admin
          })
          users.save()
          res.writeHead(200)
        } else {
          throw "poo"
        }
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    } else if(req.method === "DELETE") {
      handleDelete(req, res, /\/api\/users\/(\d+)/, users)
    } else {
      res.writeHead(200)
      // we really shouldn't send passwords to the front
      // even if they're hashed.
      res.write(JSON.stringify(
        users.items.map(u => ({ ...u, password: undefined }))
      ))
      res.end()
    }
  } else {
    // if we're here, either unauthenticated or unauthorized
    // either way, they belong on the main page, not admin
    res.writeHead(301, {
      Location: "/"
    })
    res.end()
  }
}

module.exports = { 
  authenticate, userController, parseBasic, promptForAuth, sha256 }

