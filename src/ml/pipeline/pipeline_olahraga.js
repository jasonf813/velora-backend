const { spawn } = require('child_process');

async function generateOlahragaRecommendation(userId) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', ['src/ml/model_olahraga.py']);
    let data = '', err = '';

    py.stdout.on('data', d => data += d);
    py.stderr.on('data', d => err += d);

    py.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Python exit code ${code}. Stderr: ${err}`));
      }

      if (err.trim()) {
        console.warn("Python stderr:", err.trim());
      }

      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Parse error: ${e}\nOutput: ${data}`));
      }
    });

    py.stdin.write(JSON.stringify({ user_id: userId }));
    py.stdin.end();
  });
}

module.exports = { generateOlahragaRecommendation };