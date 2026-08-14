import bcrypt from 'bcryptjs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter admin password (min 12 characters): ', async (password) => {
  if (!password || password.length < 12) {
    console.error('Error: Password must be at least 12 characters long.');
    rl.close();
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    console.log('\nGenerated bcrypt hash (Cost 12):');
    console.log(hash);
    console.log('\nAdd the following line to your .env file:');
    console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
  } catch (err) {
    console.error('Error hashing password:', err);
  } finally {
    rl.close();
  }
});
