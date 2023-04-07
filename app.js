#!/usr/bin/env node

const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("stufff.db")
// db.run(`CREATE TABLE things (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   n INTEGER,
//   x float(10,9),
//   y float(10,9),
//   who VARCHAR(255)
// )
// `)
// db.run(`CREATE TABLE users (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   username VARCHAR(255),
//   pass VARCHAR(255)
// )
// `)
//db.run("INSERT INTO users (username, pass) VALUES ('chuck', 'f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7')")

const fs = require("fs/promises");
const http = require("http"); // import the http library from node
// "data store" that we'll dump all the things in
let listOfThings = [];
// We'll assign unique ids to the incoming data, incrementing
let lastId = 0;

const getBody = require("./httpHelpers")
const { parseBasic, promptForAuth, sha256 } = require("./authHelpers")

/* our authentication mechanism proper. returns username "chuck" if the request contains
 * the Basic authorization header containg the right username and password. Otherwise it
 * prompts for a username and password by sending the appropriate headers and response code
 * to the browser and returns false
 */
const authenticate = async (req, res) => {
  const [user, pass] = parseBasic(req)
  if(user && pass) {
    const lookup = db.prepare(
      "SELECT username FROM users WHERE username=? AND pass=?")

    const soundslike = await new Promise((resolve, reject) => {
      lookup.get(user, sha256(pass), (err, user) => {
        if(err) {
          reject(err)
        } else {
          resolve(user && user.username)
        }
      })
    })
    if(soundslike) {
      return soundslike
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
    // check for auth
    const user = await authenticate(req,res)
    // if authed, do the thing
    if(user) {
      getBody(req).then(body => {
        const insert = db.prepare(
          "INSERT INTO things (n, x, y, who) VALUES (?, ?, ?, ?)")

        insert.run(body.n, body.x, body.y, user)

        res.writeHead(201)
      })
      .catch(() => res.writeHead(400))
      .finally(() => res.end())
    }
  } else if(req.method === "PUT") {
    const user = await authenticate(req,res)
    if(user) {
      getBody(req).then(body => {
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
