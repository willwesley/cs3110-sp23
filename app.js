#!/usr/bin/env node

// import sqlite library installed via npm
const sqlite3 = require("sqlite3");
// create a db instance of sqlite backed by the file stufff.db
const db = new sqlite3.Database("stufff.db")

// import http and the helpers
const http = require("http");
const getBody = require("./httpHelpers")
const { parseBasic, promptForAuth, sha256 } = require("./authHelpers")

/* our authentication mechanism proper. We're now an async function so we can
 * await a promise that we'll wrap the sql lookup in. This means we'll need to
 * await whenever we call this function, which means callers must also be async.
 * Luckily, our request handler can be async.
 *
 * Note, this is actually a huge change in the signature of this method. We're
 * doing it because it's relatively few key strokes and doesn't change the 
 * apparent intent much, but deep down, it's huge. iherduleikhardmode.
 *
 * Asynchronously returns username if the request contains a Basic authorization 
 * header containing a username and password found in the `users` table in our 
 * db. Otherwise it prompts for a username and password by sending the 
 * appropriate headers and response code to the browser and returns false
 */
const authenticate = async (req, res) => {
  const [user, pass] = parseBasic(req)
  // struggle bus here: if we pass an empty string to our `sha256` function, it
  // explodes. Previously we short circuited on an empty username. Now we check
  if(user && pass) {
    // oh yeah, you bet auth code is an attack target. let's not trust weirdos
    const lookup = db.prepare(
      "SELECT username FROM users WHERE username=? AND pass=?")

    // We're going to await a promise that we're wrapping around the sqlite call
    // I'm mildly sorry about the convoluted nonsense here. We probably should
    // pick one paradigm and run with it. But, I really didn't want to rewrite
    // all the calls to authenticate to conform to the callback paradigm, and
    // rewriting to just Promises seemed just as filthy. If all we have to do
    // to the callers is make them `await`, that might be simpler.
    //
    // The point here is that I'm minimizing the impact to the users of this
    // method by encapsulating this nonsense.
    //
    // eventually I settled on this name. ¯\_(ツ)_/¯
    const userFromDb = await new Promise((resolve, reject) => {
      // make call to async function that takes a callback
      lookup.get(user, sha256(pass), (err, user) => {
        if(err) {
          // so, `authenticate` should probably wrap this in a try ... catch
          // in case there really is an error. but, right now, we wouldn't
          // have a clue what to do with an error here. server death + stack
          // trace is "perfect."
          reject(err)
        } else {
          // no error? resolve with what we got (undefined is what we get if
          // there's nothing in the DB to match, which is falsy. huray.
          resolve(user && user.username)
        }
      })
    })
    // if we got something that wasn't falsy, cool, ship it!
    if(userFromDb) {
      return userFromDb
    }
  }
  promptForAuth(res)
  return false
}

/* http request handler (router and dispatcher)
 * @param req {http.request} the request object
 * @param res {http.response} the object for sending a response
 */
const requestHandler = async (req, res) => {
  if(req.method === "POST") {
    // check for auth, note await. authenticate is async now, bro.
    const user = await authenticate(req,res)
    // if authed, do the thing
    if(user) {
      getBody(req).then(body => {
        // prepared statement! "dear database, here's a template. also here's
        // data to use in that template. Don't mix them up. Sincerely, JS"
        const insert = db.prepare(
          "INSERT INTO things (n, x, y, who) VALUES (?, ?, ?, ?)")
        insert.run(body.n, body.x, body.y, user)
        // assuming success, lawl.
        res.writeHead(201)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "PUT") {
    const user = await authenticate(req,res)
    if(user) {
      getBody(req).then(body => {
        // prepared statement! "dear database, here's a template. also here's
        // data to use in that template. Don't mix them up. Sincerely, JS"
        const update = db.prepare(
          "UPDATE things SET n=?, x=?, y=?, who=? WHERE id=?")

        update.run(body.n, body.x, body.y, user, body.id)

        res.writeHead(200)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "DELETE") {
    const user = await authenticate(req,res)
    if(user) {
      const match = req.url.match(/\/api\/(\d+)/)
      if(match && match[1]) {
        // prepared statement! "dear database, here's a template. also here's
        // data to use in that template. Don't mix them up. Sincerely, JS"
        const remove = db.prepare(
          "DELETE FROM things WHERE id=?")

        remove.run(match[1])

        res.writeHead(200)
        res.end()
      } else {
        res.writeHead(400)
        res.end()
      }
    }
  } else {
    // we rewrite the get to do the async stufff with the database here.
    // We could have done this kind of thing for authentication too.
    db.all("SELECT * FROM things", (err, things) => {
      if(err) {
        res.writeHead(500)
      } else {
        res.writeHead(200, {
          "Content-Type": "application/json",
        })
        res.write(JSON.stringify(
          things
        ))
      }
      res.end()
    })
  }
}

// create the server and provide it the handler
const server = http.createServer(requestHandler);
server.listen(3000)
