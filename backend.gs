function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action; // 'ADD', 'UPDATE', 'DELETE'
  var passcode = data.passcode;
  
  // Simple auth check
  if (passcode !== 'vinted123') {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Unauthorized'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Check if the required headers exist. If not, create them on row 1
    if (headers.length === 0 || headers[0] === "") {
        headers = ['ID', 'Name', 'Price', 'Cost', 'Status', 'Condition', 'Tags', 'ImageURL'];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    if (action === 'ADD') {
      var item = data.item;
      var imageUrl = handleImageUpload(item.image, item.id);
      
      var newRow = [
        item.id,
        item.name,
        item.price,
        item.cost,
        item.status,
        item.condition,
        item.tags,
        imageUrl || ''
      ];
      sheet.appendRow(newRow);
      
      return ContentService.createTextOutput(JSON.stringify({success: true, item: item, imageUrl: imageUrl}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    else if (action === 'UPDATE') {
      var item = data.item;
      var originalId = data.originalId;
      var dataRange = sheet.getDataRange().getValues();
      var rowIndex = -1;
      
      for (var i = 1; i < dataRange.length; i++) {
        if (dataRange[i][0] == originalId) {
          rowIndex = i + 1; // 1-based index
          break;
        }
      }
      
      if (rowIndex > -1) {
        var imageUrl = item.image;
        // If it's base64, upload it. Otherwise it's already a URL or empty
        if (item.image && item.image.indexOf('data:image') === 0) {
            imageUrl = handleImageUpload(item.image, item.id);
        }

        var updateRow = [
          item.id,
          item.name,
          item.price,
          item.cost,
          item.status,
          item.condition,
          item.tags,
          imageUrl || dataRange[rowIndex-1][7] // preserve old if not updated
        ];
        sheet.getRange(rowIndex, 1, 1, updateRow.length).setValues([updateRow]);
        
        return ContentService.createTextOutput(JSON.stringify({success: true, imageUrl: imageUrl}))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error('Item not found');
      }
    }
    
    else if (action === 'DELETE') {
      var id = data.id;
      var dataRange = sheet.getDataRange().getValues();
      for (var i = 1; i < dataRange.length; i++) {
        if (dataRange[i][0] == id) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({success: true}))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      throw new Error('Item not found for deletion');
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var passcode = e.parameter.passcode;
  
  if (passcode !== 'vinted123') {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Unauthorized'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var dataRange = sheet.getDataRange().getValues();
  if (dataRange.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({success: true, data: []}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var items = [];
  for (var i = 1; i < dataRange.length; i++) {
    var row = dataRange[i];
    items.push({
      id: row[0],
      name: row[1],
      price: row[2],
      cost: row[3],
      status: row[4],
      condition: row[5],
      tags: row[6],
      image: row[7]
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({success: true, data: items}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Function to handle base64 image upload to Google Drive
function handleImageUpload(base64Data, filename) {
  if (!base64Data || base64Data.indexOf('data:image') !== 0) return base64Data;
  
  try {
    var splitData = base64Data.split(',');
    var type = splitData[0].split(';')[0].split(':')[1];
    var data = splitData[1];
    
    var blob = Utilities.newBlob(Utilities.base64Decode(data), type, filename);
    
    // You can replace this with a specific Folder ID if you want to store them in a specific folder.
    // var folder = DriveApp.getFolderById('YOUR_FOLDER_ID_HERE');
    // var file = folder.createFile(blob);
    var file = DriveApp.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getDownloadUrl();
  } catch (e) {
    // If it fails, just return empty string or the original data to prevent breaking
    return '';
  }
}
