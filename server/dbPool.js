const Pool = require('pg').Pool;

const pool = new Pool({
user:'BrandonPC',
password:'',
host:'localhost',
port:5432,
database:'brewhive'
})

module.exports= pool;