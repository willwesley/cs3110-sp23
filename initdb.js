#!/usr/bin/env node

// import sqlite library installed via npm
const sqlite3 = require("sqlite3");
// create a db instance of sqlite backed by the file stufff.db
const db = new sqlite3.Database("stufff.db")

// create the tables for things and users
db.run(`CREATE TABLE things (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  n INTEGER,
  x float(10,9),
  y float(10,9),
  who VARCHAR(255)
)
`)
db.run(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(255),
  pass VARCHAR(255)
)
`)
// insert a default user because of reasons
db.run("INSERT INTO users (username, pass) VALUES ('chuck', 'f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7')")
