# Third-Party Notices

This file contains information about third-party libraries used in this project.

The license scope for the project's original code, authoring tools, technical
examples, and accompanying documentation is described in [LICENSE](LICENSE).
Commercial use outside the cases permitted by that license is described in
[COMMERCIAL-USE.md](COMMERCIAL-USE.md).

The licenses of the third-party components listed below remain unchanged and
apply separately from the license of this project's original materials.

Complete upstream license texts that are not reproduced in this notice are
included in the `lib/licenses/` directory and are distributed with release
archives together with the corresponding libraries.

## Mermaid

This project uses [Mermaid](https://mermaid.js.org/) — a tool for generating diagrams and charts from text descriptions.

### License

The MIT License (MIT)

Copyright (c) 2014 - 2022 Knut Sveidqvist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Use in This Project

The `mermaid.min.js` file is included in the repository without modifications and is located in the `lib/` directory.
Mermaid version: 11.13.0.

### DOMPurify Included in Mermaid

The bundled `lib/mermaid.min.js` file includes
[DOMPurify](https://github.com/cure53/DOMPurify), which Mermaid uses to sanitize
generated markup. DOMPurify is not loaded as a separate runtime file.

DOMPurify version: 3.3.1.

DOMPurify is available under either the Apache License 2.0 or the Mozilla
Public License 2.0. Its complete upstream license file, containing both license
texts and the copyright notice, is included at
[`lib/licenses/dompurify-3.3.1-LICENSE.txt`](lib/licenses/dompurify-3.3.1-LICENSE.txt).
The corresponding upstream source is available from the
[DOMPurify 3.3.1 license page](https://github.com/cure53/DOMPurify/blob/3.3.1/LICENSE).

## jsrsasign

This project uses [jsrsasign](https://kjur.github.io/jsrsasign/) — a JavaScript cryptography library used here for offline license signature verification.

### License

jsrsasign is available under the MIT License. Its complete upstream
`LICENSE.txt` is included at
[`lib/licenses/jsrsasign-11.1.3-LICENSE.txt`](lib/licenses/jsrsasign-11.1.3-LICENSE.txt).
That file also preserves the notices and license terms for the RSA and ECC code
by Tom Wu, CryptoJS, and Bitcoin JS included by jsrsasign. The corresponding
upstream source is available from the
[jsrsasign 11.1.3 license page](https://github.com/kjur/jsrsasign/blob/11.1.3/LICENSE.txt).

### Use in This Project

The `jsrsasign-all-min.js` file is included in the repository without modifications and is located in the `lib/` directory.
jsrsasign version: 11.1.3.

## three.js

This project uses [three.js](https://threejs.org/) — a 3D/WebGL library used here for 360 background rendering.

### License

The MIT License (MIT)

Copyright (c) 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Use in This Project

The `three.min.js` file is included in the repository without modifications and is located in the `lib/` directory.
three.js version: 0.152.2 (r152).
