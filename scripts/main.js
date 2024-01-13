let _rawData;
let _jsonData;
let _csvData;
let _jsonSaveData;
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
  const entry = ele.getAttribute('data-entry');
  const isTranslated = _rawTranslated.hasOwnProperty(entry);

  if (isTranslated) {
    ele.innerText = `Original: ${_rawTranslated[entry].raw}`;
    delete _rawTranslated[entry];
    return;
  }

  const textSource = ele.innerText.slice(10); // ignore Original:

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURI(
    textSource
  )}`;

  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      const responseReturned = JSON.parse(this.responseText);
      const translations = responseReturned[0].map((text) => text[0]);
      const outputText = translations.join(' ');

      _rawTranslated[entry] = {
        raw: textSource,
        trans: outputText,
      };
      ele.innerText = `Original: ${outputText}`;
    }
  };
  xhttp.open('GET', url);
  xhttp.send();
}

function render(jsonData) {
  let tableData;
  let line = 0;

  tableData = Object.keys(jsonData)
    .map(
      (key) => `
    <div>
      <div class="text-orange-400 font-bold">⇝ ${key}</div>
      <div class="flex flex-col gap-6 mt-2">
        ${Object.keys(jsonData[key])
          .map((entry) => {
            line++;
            return `<div class="flex flex-col gap-1">
              <div class="flex items-center gap-3">
                <p class="text-[#558ab5]">~Line ${line}: [${entry}]</p>
                <div data-key="${key}" data-entry="${entry}" class="items-center gap-1 flex btn-trans px-2 py-[2px] bg-[#3877ab] text-[11px] text-semibold rounded-full cursor-pointer">
                    Machine Translate <span><img class="w-[10px] h-[10px]" src='./assets/bi_google.png'/></span>
                </div>
              </div>
              <p data-key="${key}" data-entry="${entry}" class="max-w-[85%]">Original: ${jsonData[key][entry]}</p>
              <div class="flex gap-2">
                <p class="self-end">Translate:</p>
                <input data-key="${key}" data-entry="${entry}" autocomplete="off" name="translate" class="input-translate w-1/2 px-2 py-1 border-b-[1px] border-slate-700 outline-none focus:border-gray-400 bg-transparent" placeholder="translate" />
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

function calcFileSize(file) {
  let size = file.size.toString();

  if (size.length < 7) size = `${Math.round(+size / 1024).toFixed(2)}kb`;
  else size`${(Math.round(+size / 1024) / 1000).toFixed(2)}MB`;

  return size;
}

function genCsvFileName() {
  const now = new Date();

  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Tháng bắt đầu từ 0
  const year = now.getFullYear();

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');

  return `${day}_${month}_${year}-${hours}_${minutes}`;
}

function downloadFile(data, fileType) {
  const blob = new Blob([data], {
    type: fileType == 'lua' ? 'text/text' : 'text/csv',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileType == 'lua' ? 'file_new' : genCsvFileName();

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

function loadSaveProgressFile() {
  _jsonSaveData.forEach((item) => {
    if (!item.Translation) return;

    const targetInputEl = document.querySelector(
      `input[data-key='${item.Key}'][data-entry='${item.Entry}']`
    );

    targetInputEl.value = item.Translation;

    // Temp solution for input event not firing
    targetInputEl.dispatchEvent(new InputEvent('input'));
  });
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  let size = calcFileSize(file);

  document.getElementById('bar-file-size').innerText = `File size: ${size}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    _isLoadFile = true;
    _rawData = e.target.result;
    let jsonData = parseRawDataTojsonData(e.target.result);
    document.getElementById('content').innerHTML = render(jsonData);

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
        const key = el.getAttribute('data-key');
        const entry = el.getAttribute('data-entry');
        if (el.value.length == 0) {
          delete _userTranslates[key][entry];
          return;
        }
        if (el.value.trim().length) {
          _userTranslates[key][entry] = {
            raw: _jsonData[key][entry],
            update: el.value.trim(),
          };
        }
      });
    });

    if (_jsonSaveData) loadSaveProgressFile();
  };
  reader.readAsText(file);
});

document.getElementById('progress-input').addEventListener('change', (e) => {
  const file = e.target.files[0];

  document.getElementById(
    'bar-save-file-load'
  ).innerText = `Progress file: ${file.name}`;

  const reader = new FileReader();
  reader.onload = (e) => {
    _csvData = e.target.result;

    Papa.parse(_csvData, {
      header: true,
      dynamicTyping: true,
      complete: function (results) {
        _jsonSaveData = results.data;
      },
    });

    loadSaveProgressFile();
  };
  reader.readAsText(file);
});

document.getElementById('btn-export').addEventListener('click', () => {
  if (!_jsonData) {
    alert('An error occurred, please try again!');
    return;
  }

  let tempJsonData = { ..._jsonData };

  document.querySelectorAll('input.input-translate').forEach((el) => {
    if (el.value.length) {
      tempJsonData[el.getAttribute('data-key')][el.getAttribute('data-entry')] =
        el.value;
    }
  });

  downloadFile(convertToLuaData(tempJsonData), 'lua');
});

document.getElementById('openModal').addEventListener('click', () => {
  const nums = Object.keys(_userTranslates).reduce(
    (acc, curr) => acc + Object.keys(_userTranslates[curr]).length,
    0
  );

  let diffRender = Object.keys(_userTranslates)
    .map(
      (key) => `
    <div>
      <div class="flex gap-1 items-center text-orange-400 font-semibold">⇝ ${key}
        <p class="font-normal text-slate-400 text-sm">
          (${Object.values(_userTranslates[key]).length}/${
        Object.values(_jsonData[key]).length
      })
        </p>
      </div>
    </div>
  `
    )
    .join('');

  document.querySelector('.modal-content').innerHTML = diffRender;
  document.getElementById('modal-status').innerText = `(${nums}/${
    _numberOfLines ?? '_'
  })`;
});

document.getElementById('btn-save').addEventListener('click', () => {
  if (!_jsonData) {
    alert('An error occurred, please try again!');
    return;
  }

  const outArrayCsvData = [['Key', 'Entry', 'Raw', 'Translation']];

  document.querySelectorAll('input.input-translate').forEach((el) => {
    const key = el.getAttribute('data-key');
    const entry = el.getAttribute('data-entry');

    outArrayCsvData.push([key, entry, _jsonData[key][entry], el.value]);
  });

  downloadFile(Papa.unparse(outArrayCsvData), 'csv');
});
