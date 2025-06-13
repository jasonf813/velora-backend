const { spawn } = require('child_process');

function runMLModel(profileData) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['src/ml/model.py']);

    let result = '';
    let error = '';

    python.stdout.on('data', (data) => {
      result += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const output = JSON.parse(result);
          resolve(output);
        } catch (err) {
          reject(`Gagal parsing JSON dari output model: ${err}\nOutput mentah: ${result}`);
        }
      } else {
        reject(`Model Python gagal dengan kode ${code}\nError: ${error}`);
      }
    });

    python.stdin.write(JSON.stringify(profileData));
    python.stdin.end();
  });
}

module.exports = runMLModel;