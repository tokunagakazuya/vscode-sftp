jest.mock('fs');

import { vol } from 'memfs';
import * as fs from 'fs';

import { log, error } from "console";
import { FileService, LocalFileSystem } from '../../core';
import LocalRemoteFileSystem from '../../../test/helper/localRemoteFs';

import prepareTest from '../../../test/helper/prepareTest';
import { file } from '../../../test/helper/fillFs';

// restore console log and error to its original implementation to avoid jest decorations
console.log = log;
console.error = error;

// Use hacked 'put' from LocalRemoteFileSystem (not using createWritesStream) to avoid memfs stream close bug
LocalFileSystem.prototype.put = LocalRemoteFileSystem.prototype.put;


describe.skip('filewatch', () => {

  let fileService: FileService | null;

  afterEach(() => {
    fileService && fileService.dispose();
    fileService = null;
  });

  afterEach(() => {
    vol.reset();
  });

  test('watch - create local file/dir', async () => {
    const fileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
        },
      },
    };
    const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, fileTree, fileTree,
      undefined,
      () => {
        // create new file /local/c/newfile'
        fs.writeFileSync("/local/c/newfile", "newfile");
        // create new dir /local/d/newdir
        fs.mkdirSync("/local/c/d/newdir");
      });


    expect(vol.toJSON()).toEqual({
      "/local/a": "a",
      "/local/b": "b",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "c-b",
      "/local/c/c-c": "c-c",
      "/local/c/newfile": "newfile",
      "/local/c/d/d-a": "d-a",
      "/local/c/d/d-b": "d-b",
      "/local/c/d/newdir": null,
      "/remote/a": "a",
      "/remote/b": "b",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "c-b",
      "/remote/c/c-c": "c-c",
      "/remote/c/newfile": "newfile",
      "/remote/c/d/d-a": "d-a",
      "/remote/c/d/d-b": "d-b",
      "/remote/c/d/newdir": null,
    });

    expect(logLines.join('\n')).not.toMatch("Error: E");
    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\c\\newfile",
    ]);
    expect(logLines).toContain("folder \\local\\c\\d\\newdir transfered.");
  });
  test('watch - create local link/dirlink', async () => {
    const fileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
        },
      },
    };
    const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, fileTree, fileTree,
      undefined,
      () => {
        // create new link to file /local/c/d/d-c -> /local/a
        fs.symlinkSync("/local/a", "/local/c/d/linktoa");
        // create new link to dir /local/c/d/linktod -> /local/c/d
        fs.symlinkSync("/local/c/d", "/local/c/d/linktod");
      });

    expect(fs.lstatSync('/local/c/d/linktoa').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/local/c/d/linktoa').isFile()).toBe(true);
    expect(fs.lstatSync('/remote/c/d/linktoa').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/remote/c/d/linktoa').isFile()).toBe(true);

    expect(fs.lstatSync('/local/c/d/linktod').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/local/c/d/linktod').isDirectory()).toBe(true);
    expect(fs.lstatSync('/remote/c/d/linktod').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/remote/c/d/linktod').isDirectory()).toBe(true);

    // use toTree because toJSON does not display links
    expect(vol.toTree()).toEqual(`\\
├─ \\local/
│  ├─ a
│  ├─ b
│  └─ c/
│     ├─ c-a
│     ├─ c-b
│     ├─ c-c
│     └─ d/
│        ├─ d-a
│        ├─ d-b
│        ├─ linktoa → /local/a
│        └─ linktod → /local/c/d
└─ \\remote/
   ├─ a
   ├─ b
   └─ c/
      ├─ c-a
      ├─ c-b
      ├─ c-c
      └─ d/
         ├─ d-a
         ├─ d-b
         ├─ linktoa → /local/a
         └─ linktod → /local/c/d`
    );

    expect(logLines.join('\n')).not.toMatch("Error: E");
    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\c\\d\\linktoa",
      "local ➞ remote \\local\\c\\d\\linktod",
    ]);
  });
  test('watch - update local file', async () => {
    const fileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
        },
      },
    };
    const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, fileTree, fileTree,
      undefined,
      () => {
        // update file /local/c/newfile'
        fs.writeFileSync("/local/c/c-b", "changed c-b");
      });


    expect(vol.toJSON()).toEqual({
      "/local/a": "a",
      "/local/b": "b",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "changed c-b",
      "/local/c/c-c": "c-c",
      "/local/c/d/d-a": "d-a",
      "/local/c/d/d-b": "d-b",
      "/remote/a": "a",
      "/remote/b": "b",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "changed c-b",
      "/remote/c/c-c": "c-c",
      "/remote/c/d/d-a": "d-a",
      "/remote/c/d/d-b": "d-b",
    });

    expect(logLines.join('\n')).not.toMatch("Error: E");
    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\c\\c-b",
    ]);
  });
  test('watch - delete local file/dir', async () => {
    const fileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
        },
      },
    };
    const { logLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, fileTree, fileTree,
      undefined,
      () => {
        // delete file 
        fs.rmSync("/local/c/c-c");
        // delete dir 
        fs.rmSync("/local/c/d", { recursive: true });
      });


    expect(vol.toJSON()).toEqual({
      "/local/a": "a",
      "/local/b": "b",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "c-b",
      "/remote/a": "a",
      "/remote/b": "b",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "c-b",
    });

    expect(logLines.join('\n')).not.toMatch("Error: E");
    expect(logLines.filter(l => l.includes("[watcher/"))).toEqual([
      "[watcher/removed] \\local\\c\\c-c",
      "[watcher/removed] \\local\\c\\d"
    ]);
  });
  test('watch - ignore file/dir', async () => {
    const remoteFileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
          e: {
            'e-a': file('e-a', 1),
            'e-b': file('e-b', 1),
          },
          i: {
            'i-a': file('i-a', 1),
            'i-b': file('i-b', 1),
          }
        },
      },
      present_but_ignored_h: {
        'h-a': file('h-a', 1),
      }
    }
    const localFileTree = {
      ...remoteFileTree,
      c: {
        ...remoteFileTree.c,
        ignored_f: {
          'f-a': file('f-a', 1),
          'f-b': file('f-b', 1),
          ignored_g: {
            'g-a': file('g-a', 1),
            'g-b': file('g-b', 1),
          }
        }
      },
    };
    const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [
          "ignored_f",
          "present_but_ignored_h",
        ],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, localFileTree, remoteFileTree,
      undefined,
      () => {
        // create new file /local/c/newfile'
        fs.writeFileSync("/local/c/newfile", "newfile");
        // create new dir /local/d/newdir
        fs.mkdirSync("/local/c/d/newdir");
        // update file /local/c/c-b'
        fs.writeFileSync("/local/c/c-b", "changed c-b");
        // delete file
        fs.rmSync("/local/b");
        // delete dir
        fs.rmdirSync("/local/c/d/i", { recursive: true });

        // create ignore new file /local/c/ignored_e/newfile'
        fs.writeFileSync("/local/c/ignored_f/newfile", "newfile");
        // create new ignored dir /local/c/ignored_e/newdir
        fs.mkdirSync("/local/c/ignored_f/newdir");
        // update ignored file /local/c/ignored_e/e-b'
        fs.writeFileSync("/local/c/ignored_f/f-b", "changed f-b");
        // delete ignored file
        fs.rmSync("/local/present_but_ignored_h/h-a");
        // delete ignored dir
        fs.rmdirSync("/local/present_but_ignored_h", { recursive: true });

      });


    expect(vol.toJSON()).toEqual({
      "/local/a": "a",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "changed c-b",
      "/local/c/c-c": "c-c",
      "/local/c/newfile": "newfile",
      "/local/c/d/d-a": "d-a",
      "/local/c/d/d-b": "d-b",
      "/local/c/d/e/e-a": "e-a",
      "/local/c/d/e/e-b": "e-b",
      "/local/c/d/newdir": null,
      "/local/c/ignored_f/f-a": "f-a",
      "/local/c/ignored_f/f-b": "changed f-b",
      "/local/c/ignored_f/ignored_g/g-a": "g-a",
      "/local/c/ignored_f/ignored_g/g-b": "g-b",
      "/local/c/ignored_f/newdir": null,
      "/local/c/ignored_f/newfile": "newfile",
      "/remote/a": "a",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "changed c-b",
      "/remote/c/c-c": "c-c",
      "/remote/c/newfile": "newfile",
      "/remote/c/d/d-a": "d-a",
      "/remote/c/d/d-b": "d-b",
      "/remote/c/d/e/e-a": "e-a",
      "/remote/c/d/e/e-b": "e-b",
      "/remote/c/d/newdir": null,
      "/remote/present_but_ignored_h/h-a": "h-a",
    });

    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\c\\c-b",
      "local ➞ remote \\local\\c\\newfile",
    ]);
    expect(logLines).toContain("folder \\local\\c\\d\\newdir transfered.");
  });
  test('watch - global ignore file/dir', async () => {
    const remoteFileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
          e: {
            'e-a': file('e-a', 1),
            'e-b': file('e-b', 1),
          },
          i: {
            'i-a': file('i-a', 1),
            'i-b': file('i-b', 1),
          }
        },
      },
      present_but_ignored_h: {
        'h-a': file('h-a', 1),
      }
    }
    const localFileTree = {
      ...remoteFileTree,
      c: {
        ...remoteFileTree.c,
        ignored_f: {
          'f-a': file('f-a', 1),
          'f-b': file('f-b', 1),
          ignored_g: {
            'g-a': file('g-a', 1),
            'g-b': file('g-b', 1),
          }
        }
      },
    }; const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [
        ],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
      "ignore": [
        "ignored_f",
        "present_but_ignored_h",
      ],
    }, localFileTree, remoteFileTree,
      undefined,
      () => {
        // create new file /local/c/newfile'
        fs.writeFileSync("/local/c/newfile", "newfile");
        // create new dir /local/d/newdir
        fs.mkdirSync("/local/c/d/newdir");
        // update file /local/c/c-b'
        fs.writeFileSync("/local/c/c-b", "changed c-b");
        // delete file
        fs.rmSync("/local/b");
        // delete dir
        fs.rmdirSync("/local/c/d/i", { recursive: true });

        // create ignore new file /local/c/ignored_e/newfile'
        fs.writeFileSync("/local/c/ignored_f/newfile", "newfile");
        // create new ignored dir /local/c/ignored_e/newdir
        fs.mkdirSync("/local/c/ignored_f/newdir");
        // update ignored file /local/c/ignored_e/e-b'
        fs.writeFileSync("/local/c/ignored_f/f-b", "changed f-b");
        // delete ignored file
        fs.rmSync("/local/present_but_ignored_h/h-a");
        // delete ignored dir
        fs.rmdirSync("/local/present_but_ignored_h", { recursive: true });

      });


    expect(vol.toJSON()).toEqual({
      "/local/a": "a",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "changed c-b",
      "/local/c/c-c": "c-c",
      "/local/c/newfile": "newfile",
      "/local/c/d/d-a": "d-a",
      "/local/c/d/d-b": "d-b",
      "/local/c/d/e/e-a": "e-a",
      "/local/c/d/e/e-b": "e-b",
      "/local/c/d/newdir": null,
      "/local/c/ignored_f/f-a": "f-a",
      "/local/c/ignored_f/f-b": "changed f-b",
      "/local/c/ignored_f/ignored_g/g-a": "g-a",
      "/local/c/ignored_f/ignored_g/g-b": "g-b",
      "/local/c/ignored_f/newdir": null,
      "/local/c/ignored_f/newfile": "newfile",
      "/remote/a": "a",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "changed c-b",
      "/remote/c/c-c": "c-c",
      "/remote/c/newfile": "newfile",
      "/remote/c/d/d-a": "d-a",
      "/remote/c/d/d-b": "d-b",
      "/remote/c/d/e/e-a": "e-a",
      "/remote/c/d/e/e-b": "e-b",
      "/remote/c/d/newdir": null,
      "/remote/present_but_ignored_h/h-a": "h-a",
    });

    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\c\\c-b",
      "local ➞ remote \\local\\c\\newfile",
    ]);
    expect(logLines).toContain("folder \\local\\c\\d\\newdir transfered.");
  });
  test('watch - update local link to (un)watched file', async () => {
    const fileTree = {
      a: file('a', 1),
      b: file('b', 1),
      c: {
        'c-a': file('c-a', 1),
        'c-b': file('c-b', 1),
        'c-c': file('c-c', 1),
        d: {
          'd-a': file('d-a', 1),
          'd-b': file('d-b', 1),
        },
        ignore_e: {
          'e-a': file('e-a', 1),
        }
      },
    };
    const { logLines, sortedUniqArrowLines } = await prepareTest({
      "watcher": {
        "files": "**/*",
        "ignore": [
          'ignore_e'
        ],
        "autoUpload": true,
        "autoDelete": true
      },
      "syncOption": {
        "delete": true,
        "update": true,
        "skipCreate": false,
        "ignoreExisting": false,
      },
    }, fileTree, fileTree,
      () => {
        // create new link to watched file 
        fs.symlinkSync("/local/a", "/local/c/d/linkto_watched_a");
        fs.symlinkSync("/remote/a", "/remote/c/d/linkto_watched_a");
        // create new link to unwatched file
        fs.symlinkSync("/local/c/ignore_e/e-a", "/local/c/d/linkto_unwatched_e-a");
        fs.symlinkSync("/remote/c/ignore_e/e-a", "/remote/c/d/linkto_unwatched_e-a");

        // use toTree because toJSON does not display links
        expect(vol.toTree() + '\n').toEqual(`\\
├─ \\local/
│  ├─ a
│  ├─ b
│  └─ c/
│     ├─ c-a
│     ├─ c-b
│     ├─ c-c
│     ├─ d/
│     │  ├─ d-a
│     │  ├─ d-b
│     │  ├─ linkto_watched_a → /local/a
│     │  └─ linkto_unwatched_e-a → /local/c/ignore_e/e-a
│     └─ ignore_e/
│        └─ e-a
└─ \\remote/
   ├─ a
   ├─ b
   └─ c/
      ├─ c-a
      ├─ c-b
      ├─ c-c
      ├─ d/
      │  ├─ d-a
      │  ├─ d-b
      │  ├─ linkto_watched_a → /remote/a
      │  └─ linkto_unwatched_e-a → /remote/c/ignore_e/e-a
      └─ ignore_e/
         └─ e-a
`
        );
      },
      () => {
        // change watched target 
        fs.writeFileSync('/local/a', 'changed a');

        // change unwatched target
        fs.writeFileSync('/local/c/ignore_e/e-a', 'changed e-a');
      });


    expect(fs.lstatSync('/local/c/d/linkto_watched_a').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/local/c/d/linkto_watched_a').isFile()).toBe(true);
    expect(fs.lstatSync('/remote/c/d/linkto_watched_a').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/remote/c/d/linkto_watched_a').isFile()).toBe(true);

    expect(fs.lstatSync('/local/c/d/linkto_unwatched_e-a').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/local/c/d/linkto_unwatched_e-a').isFile()).toBe(true);
    expect(fs.lstatSync('/remote/c/d/linkto_unwatched_e-a').isSymbolicLink()).toBe(true);
    expect(fs.statSync('/remote/c/d/linkto_unwatched_e-a').isFile()).toBe(true);

    // use toTree because toJSON does not display links
    expect(vol.toTree() + '\n').toEqual(`\\
├─ \\local/
│  ├─ a
│  ├─ b
│  └─ c/
│     ├─ c-a
│     ├─ c-b
│     ├─ c-c
│     ├─ d/
│     │  ├─ d-a
│     │  ├─ d-b
│     │  ├─ linkto_watched_a → /local/a
│     │  └─ linkto_unwatched_e-a → /local/c/ignore_e/e-a
│     └─ ignore_e/
│        └─ e-a
└─ \\remote/
   ├─ a
   ├─ b
   └─ c/
      ├─ c-a
      ├─ c-b
      ├─ c-c
      ├─ d/
      │  ├─ d-a
      │  ├─ d-b
      │  ├─ linkto_watched_a → /remote/a
      │  └─ linkto_unwatched_e-a → /remote/c/ignore_e/e-a
      └─ ignore_e/
         └─ e-a
`
    );

    expect(vol.toJSON()).toEqual({
      "/local/a": "changed a",
      "/local/b": "b",
      "/local/c/c-a": "c-a",
      "/local/c/c-b": "c-b",
      "/local/c/c-c": "c-c",
      "/local/c/d/d-a": "d-a",
      "/local/c/d/d-b": "d-b",
      "/local/c/ignore_e/e-a": "changed e-a",
      "/remote/a": "changed a",
      "/remote/b": "b",
      "/remote/c/c-a": "c-a",
      "/remote/c/c-b": "c-b",
      "/remote/c/c-c": "c-c",
      "/remote/c/d/d-a": "d-a",
      "/remote/c/d/d-b": "d-b",
      "/remote/c/ignore_e/e-a": "e-a",
    });

    expect(logLines.join('\n')).not.toMatch("Error: E");
    expect(sortedUniqArrowLines).toEqual([
      "local ➞ remote \\local\\a",
    ]);
  });
});
