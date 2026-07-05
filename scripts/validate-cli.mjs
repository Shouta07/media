// Validate an existing article: node validate-cli.mjs <slug>
import { validateFile } from './lib/validate.mjs';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node validate-cli.mjs <slug>');
  process.exit(2);
}
const { errors, warnings } = validateFile(slug);
warnings.forEach((w) => console.log(`⚠️  ${w}`));
errors.forEach((e) => console.error(`❌ ${e}`));
if (errors.length) process.exit(1);
console.log(`✅ ${slug}: OK${warnings.length ? ` (${warnings.length} warnings)` : ''}`);
