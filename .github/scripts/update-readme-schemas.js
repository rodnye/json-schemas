import { promises as fs } from 'fs';
import { join } from 'path';

const START_MARKER = '<!-- SCHEMAS -->';
const END_MARKER = '<!-- /SCHEMAS -->';
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1];

/**
 * Updatea el $id de un archivo schema JSON con la URL pública
 */
const updateSchemaId =  async (filePath, newId) => {
  const content = await fs.readFile(filePath, 'utf8');
  let schema;
  try {
    schema = JSON.parse(content);
  } catch (err) {
    console.error(`Error parseando ${filePath}:`, err.message);
    return false;
  }

  if (schema.$id === newId) {
    return false;
  }

  schema.$id = newId;

  await fs.writeFile(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log(`Actualizado $id en ${filePath}`);
  return true;
}

const main = async () => {
  const readmePath = join(process.cwd(), 'README.md');
  const readmeContent = await fs.readFile(readmePath, 'utf8');

  const startIndex = readmeContent.indexOf(START_MARKER);
  const endIndex = readmeContent.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    console.error('FATAL!!! Markers not found in README.md');
    process.exit(1);
  }

  const schemasDir = join(process.cwd(), 'schemas');
  let schemaFiles = await fs.readdir(schemasDir);
  schemaFiles = schemaFiles.filter((file) => file.endsWith('.json'));

  const baseUrl = `https://${REPO_OWNER}.github.io/${REPO_NAME}/schemas/`;

  // los $id de cada schema
  let anySchemaUpdated = false;
  for (const file of schemaFiles) {
    const filePath = join(schemasDir, file);
    const newId = baseUrl + file;
    const updated = await updateSchemaId(filePath, newId);
    if (updated) anySchemaUpdated = true;
  }

  const schemaUrls = schemaFiles
    .map((file) => `- ${baseUrl}${file}`)
    .join('\n');

  const newSection = `${START_MARKER}\n${schemaUrls}\n${END_MARKER}`;
  const before = readmeContent.substring(0, startIndex);
  const after = readmeContent.substring(endIndex + END_MARKER.length);
  const newReadme = before + newSection + after;

  let readmeUpdated = false;
  if (newReadme !== readmeContent) {
    await fs.writeFile(readmePath, newReadme, 'utf8');
    console.log('README.md updated');
    readmeUpdated = true;
  } else {
    console.log('No changes needed in README.md');
  }
 
  // evitar commits vacios
  if (!anySchemaUpdated && !readmeUpdated) {
    console.log('No updates performed.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
