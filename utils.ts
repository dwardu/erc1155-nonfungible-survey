import fs from 'fs';
import path from 'path';

export function cached(...paths: string[]) {
  return <T>(target: (arg: string) => Promise<T | null>) => {
    return async (arg: string): Promise<T | null> => {
      const filePath = path.join('.cache', ...paths, `${arg}.json`)
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath).toString());
      } else {
        console.debug(`Miss: ${filePath}`);
        const data = await target(arg);
        if (data) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          return data;
        } else {
          return null;
        }
      }
    }
  }
}
