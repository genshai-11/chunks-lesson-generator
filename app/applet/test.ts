const fetch = require('node-fetch');

async function test() {
  const url = 'http://34.9.114.40:20128/v1/models';
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer sk-ba04304581f3081e-z78xn9-2f401106' }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text.substring(0, 500));
}

test();
