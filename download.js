import https from 'https';
import fs from 'fs';

const fileId = '15lZEajmB9F1iwsMZsLmc_jClFJ0Wgw6k';
const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
const dest = './public/avatar.jpg';

https.get(url, (res) => {
  if (res.statusCode === 302 || res.statusCode === 303) {
    https.get(res.headers.location, (res2) => {
      const file = fs.createWriteStream(dest);
      res2.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Downloaded successfully');
      });
    });
  } else {
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Downloaded successfully');
    });
  }
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
