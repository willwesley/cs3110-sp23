
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

/* deletes are pretty damn uniform
 * @param req request object
 * @param res response object
 * @param regex pattern to match cid that has one group
 * @param collection locallydb collection to delete from
 */
const handleDelete = (req, res, regex, collection) => {
  const match = req.url.match(regex)
  if(match && match[1]) {
    collection.remove(1*match[1])
    collection.save()
    res.writeHead(200)
    res.end()
    return true
  } else {
    res.writeHead(400)
    res.end()
    return false
  }
}

module.exports = { handleDelete, getBody }

