const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'controllers', 'collection.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace Request with AuthenticatedRequest
content = content.replace(/import \{ Request, Response \} from 'express';/, "import { Response } from 'express';\nimport { AuthenticatedRequest } from '../types';");
content = content.replace(/req: Request/g, 'req: AuthenticatedRequest');

// Fix string | string[] error for search param
content = content.replace(/const search = req\.query\.search;/, 'const search = req.query.search as string;');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed collection.controller.ts');
