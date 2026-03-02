import { promises as fs } from 'fs';
import { join } from 'path';

const START_MARKER = '<!-- SCHEMAS -->';
const END_MARKER = '<!-- /SCHEMAS -->';
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1];

/**
 * Recursively finds all .json files in a directory
 */
const findJsonFilesRecursively = async (dir) => {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const subDirFiles = await findJsonFilesRecursively(fullPath);
      results = results.concat(subDirFiles);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Gets the relative path from the base directory
 */
const getRelativePath = (fullPath, baseDir) => {
  return fullPath.replace(baseDir + '/', '');
};

/**
 * Updates the $id of a JSON schema file with the public URL
 */
const updateSchemaId = async (filePath, newId) => {
  const content = await fs.readFile(filePath, 'utf8');
  let schema;
  try {
    schema = JSON.parse(content);
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
    return false;
  }

  if (schema.$id === newId) {
    return false;
  }

  schema.$id = newId;

  await fs.writeFile(filePath, JSON.stringify(schema, null, 2) + '\n', 'utf8');
  console.log(`Updated $id in ${filePath}`);
  return true;
};

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

  const schemaFiles = await findJsonFilesRecursively(schemasDir);

  console.log(`Found ${schemaFiles.length} schema files:`);
  schemaFiles.forEach((file) =>
    console.log(`  - ${getRelativePath(file, schemasDir)}`),
  );

  const baseUrl = `https://${REPO_OWNER}.github.io/${REPO_NAME}/schemas/`;

  // Update $id for each schema
  let anySchemaUpdated = false;
  for (const filePath of schemaFiles) {
    const relativePath = getRelativePath(filePath, schemasDir);
    const newId = baseUrl + relativePath;
    const updated = await updateSchemaId(filePath, newId);
    if (updated) anySchemaUpdated = true;
  }

  // Generate list of URLs for README (sorted alphabetically)
  const schemaUrls = schemaFiles
    .map((filePath) => getRelativePath(filePath, schemasDir))
    .sort()
    .map((relativePath) => `- ${baseUrl}${relativePath}`)
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

  if (!anySchemaUpdated && !readmeUpdated) {
    console.log('No updates performed.');
    process.exit(0);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
