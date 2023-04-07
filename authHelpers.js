const crypto = require("crypto");

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

module.exports = { parseBasic, promptForAuth, sha256 }

