
/* a function that parses a string as either form query or json
 * @param str {String} the string to be parsed.
 * @param type {String} a content-type string
 * @return {Object} A javascript value parsed.
 */
const parseData = (str, type) => {
  if(type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(str.split("&").map((q) => q.split("=")))
  } else {
    return JSON.parse(str)
  }
}

/* get the body from a request, semi-intelligently
 * @param req {http.request} the request object, duh.
 * @return {Promise} that might someday contain a javascript value parsed from
 *   the body of the request
 */
const getBody = (req) => new Promise((resolve, reject) => {
  let body = ""
  // accumulate body
  req.on("data", (data) => {
    body += data
  })
  // body complete, try to parse
  req.on("end", () => {
    try {
      const parsed = parseData(body, req.headers["content-type"])
      resolve(parsed)
    } catch (e) {
      reject(parsed)
    }
  })
})

module.exports = getBody

