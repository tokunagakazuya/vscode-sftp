import { vol } from 'memfs';
import * as fs from 'fs';
import * as path from 'path';

const fillFs = (obj: FileTree) => {
    const files: { [x: string]: string } = {};
    const dirs: string[] = [];
    const stats: {
        [x: string]: {
            mtime: Date;
        };
    } = {};
    const processDirTree = (obj1, filepath = '/') => {
        const keys = Object.keys(obj1);
        if (keys.length <= 0) {
            dirs.push(filepath);
            return;
        }

        keys.forEach(key => {
            const fullpath = path.join(filepath, key);
            if (obj1[key].$$type === 'file') {
                files[fullpath] = obj1[key].content;
                stats[fullpath] = obj1[key];
            } else {
                processDirTree(obj1[key], fullpath);
            }
        });
    };
    processDirTree(obj);
    vol.fromJSON(files, '/');
    dirs.forEach(dir => fs.mkdirSync(dir));
    Object.keys(stats).forEach(filepath => {
        fs.utimesSync(filepath, stats[filepath].mtime, stats[filepath].mtime);
    });
};

const file = (c, time = 0) => ({
    $$type: 'file',
    content: c,
    mtime: new Date(new Date().getTime() + time * 1000),
});

type FileTree = { [fileOrDir: string]: ReturnType<typeof file> | FileTree };


export default fillFs;

export { file, FileTree };