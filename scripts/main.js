let _rawData;
let _jsonData;
let _numberOfLines;
let _rawTranslated = {};
let _userTranslates = {};
let _isEdited = false;
let _isLoadFile = false;

function parseRawDataTojsonData(data) {
  let jsonData;
  jsonData = data.replace(/^return\s+{/i, '{'); // remove return
  jsonData = jsonData.replace(/\["/g, '"').replace(/"]/g, '"'); // remove brackets
  jsonData = jsonData.replace(/;\s*$/gm, ','); // replace comma
  jsonData = jsonData.replace(/\s*=\s*"/g, ': "').replace(/"\s*=\s*{/gm, '":{'); // replace colon
  jsonData = jsonData.replace(/"\s*,\s*$/gm, function (match, offset, str) {
    if (str.substring(offset).slice(0, 5).includes('}')) {
      return '"';
    }
    return '",';
  });
  jsonData = jsonData.replace(/,\s*([^,]*)$/, '\n}');
  jsonData = jsonData.replace(/\\n/g, '\\\\n');
  jsonData = jsonData.replace(/\\"/g, '\\\\\\"');

  _jsonData = JSON.parse(jsonData);
  Object.keys(_jsonData).forEach((key) => {
    _userTranslates[key] = {};
  });

  _numberOfLines = Object.keys(_jsonData).reduce(
    (acc, curr) => acc + Object.keys(_jsonData[curr]).length,
    0
  );

  document.getElementById('bar-line').innerText = `Lines: ${_numberOfLines}`;

  return _jsonData;
}

function handleTranslateGG(ele) {
  const _entry = ele.getAttribute('data-entry');
  const isTranslated = _rawTranslated.hasOwnProperty(_entry);

  if (isTranslated) {
    ele.innerText = `Original: ${_rawTranslated[_entry].raw}`;
    delete _rawTranslated[_entry];
    return;
  }

  const _text = ele.innerText.slice(10); // ignore Original:

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURI(
    _text
  )}`;

  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      const responseReturned = JSON.parse(this.responseText);
      const translations = responseReturned[0].map((text) => text[0]);
      const outputText = translations.join(' ');

      _rawTranslated[_entry] = {
        raw: _text,
        trans: outputText,
      };
      ele.innerText = `Original: ${outputText}`;
    }
  };
  xhttp.open('GET', url);
  xhttp.send();
}

function jsonToTable(jsonData) {
  let tableData;
  let _line = 0;

  tableData = Object.keys(jsonData)
    .map(
      (key) => `
    <div>
      <div class="text-orange-400 font-bold">⇝ ${key}</div>
      <div class="flex flex-col gap-6 mt-2">
        ${Object.keys(jsonData[key])
          .map((entry) => {
            _line++;
            return `<div class="flex flex-col gap-1">
              <div class="flex items-center gap-3">
                <p class="text-[#558ab5]">~Line ${_line}: [${entry}]</p>
                <div data-key="${key}" data-entry="${entry}" class="items-center gap-1 flex btn-trans px-2 py-[2px] bg-[#3877ab] text-[11px] text-semibold rounded-full cursor-pointer">
                    Machine Translate <span><img class="w-[10px] h-[10px]" src='./assets/bi_google.png'/></span>
                </div>
              </div>
              <p data-key="${key}" data-entry="${entry}" class="max-w-[85%]">Original: ${jsonData[key][entry]}</p>
              <div class="flex gap-2 items-center">
                <p>Translate:</p>
                <input data-key="${key}" data-entry="${entry}" autocomplete="off" name="translate" class="input-translate w-1/2 px-4 py-1 border-b-[1px] border-slate-700 outline-none focus:border-gray-400 bg-transparent" placeholder="translate" />
              </div>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  `
    )
    .join('');

  return tableData;
}

function updateEditStatus() {
  const status = _isEdited ? 'Edited' : '_';

  document.getElementById('bar-status').innerText = `Status: ${status}`;
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  let size = file.size.toString();

  if (size.length < 7) size = `${Math.round(+size / 1024).toFixed(2)}kb`;
  else size`${(Math.round(+size / 1024) / 1000).toFixed(2)}MB`;

  document.getElementById('bar-file-size').innerText = `File size: ${size}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    _isLoadFile = true;
    _rawData = e.target.result;
    let jsonData = parseRawDataTojsonData(e.target.result);
    document.getElementById('content').innerHTML = jsonToTable(jsonData);

    // add event translate for original text
    document.querySelectorAll('.btn-trans').forEach((el) =>
      el.addEventListener('click', () => {
        const targetTextEl = el.parentElement.nextElementSibling;

        handleTranslateGG(targetTextEl);
      })
    );

    document.querySelectorAll('input.input-translate').forEach((el) => {
      el.addEventListener('input', () => {
        _isEdited = true;
        updateEditStatus();
        if (el.value.length) {
          const key = el.getAttribute('data-key');
          const entry = el.getAttribute('data-entry');
          _userTranslates[key][entry] = {
            raw: _jsonData[key][entry],
            update: el.value,
          };
        }
      });
    });
  };
  reader.readAsText(file);
});

function downloadFile(luaData) {
  const blob = new Blob([luaData], { type: 'text/text' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'file_new';

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function convertToLuaData(obj) {
  function processObject(obj, currentIndent, isFirstLevel = true) {
    let result = '{\n';
    const keys = Object.keys(obj);

    keys.forEach((key, index) => {
      const value = obj[key];
      const valueType = typeof value;

      if (!isFirstLevel) {
        result += currentIndent + '["' + key + '"] = ';
      } else {
        result += '["' + key + '"]=';
      }

      if (valueType === 'object') {
        result += processObject(value, currentIndent + '\t', false);
      } else if (valueType === 'string') {
        result += '"' + value + '"';
      } else {
        result += value;
      }

      result +=
        index < keys.length - 1 ? ';\n' : ';\n' + currentIndent.slice(0, -1);
    });

    result += currentIndent + '}';
    return result;
  }

  return 'return ' + processObject(obj, '') + '\n';
}

document.getElementById('btn-export').addEventListener('click', () => {
  if (!_isLoadFile) {
    alert('Please choose file first!');
    return;
  }

  let tempJsonData = { ..._jsonData };

  document.querySelectorAll('input.input-translate').forEach((el) => {
    if (el.value.length) {
      tempJsonData[el.getAttribute('data-key')][el.getAttribute('data-entry')] =
        el.value;
    }
  });

  downloadFile(convertToLuaData(tempJsonData));
});

document.getElementById('openModal').addEventListener('click', () => {
  let nums = 0;

  let diffRender = Object.keys(_userTranslates)
    .map(
      (key) => `
    <div>
      <div class="text-orange-400 font-semibold">⇝ ${key}</div>
      <div class="flex flex-col gap-4 mt-2">
        ${Object.keys(_userTranslates[key])
          .map((entry) => {
            nums++;
            return `<div class="flex flex-col gap-2">
              <p class="text-[#4779a1]">[${entry}]</p>
              <p data-key="${key}" data-entry="${entry}">Original: ${_userTranslates[key][entry].raw}</p>
              <p>Translate: ${_userTranslates[key][entry].update}</p>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  `
    )
    .join('');

  document.querySelector('.modal-content').innerHTML = diffRender;
  document.getElementById(
    'modal-status'
  ).innerText = `(${nums}/${_numberOfLines ?? '_'})`;
});
