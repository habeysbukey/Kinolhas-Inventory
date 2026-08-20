/**
 * Kinolhas School Stock Inventory — Google Apps Script backend.
 *
 * SETUP:
 * 1. Open your Google Sheet (the same one used for the original stock system).
 * 2. Extensions > Apps Script.
 * 3. Delete any starter code and paste this whole file in.
 * 4. Run the "seedItemsIfEmpty" function once from the toolbar (▶) to create
 *    the App_Items / App_StockLog tabs and load the starting stock list.
 *    You may be asked to authorize the script — allow it.
 * 5. Deploy > New deployment > select type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the Web App URL it gives you and paste it into API_URL in src/App.jsx.
 */

var ITEMS_SHEET = 'App_Items';
var LOG_SHEET = 'App_StockLog';

// One-time seed data (id, name, category, totalQty, availableQty)
var SEED_ROWS = [["i1", "A3 White Paper", "Stationery", 0, 0], ["i2", "A4 White Paper", "Stationery", 0, 0], ["i3", "A4 Color Paper", "Craft & Art", 10, 10], ["i4", "Airfreshner", "Cleaning", 0, 0], ["i5", "Airfreshner big", "Cleaning", 0, 0], ["i6", "Ball (Badminton)", "Sports", 0, 0], ["i7", "Ball (basketball)", "Sports", 0, 0], ["i8", "Ball (Netball)", "Sports", 0, 0], ["i9", "Ball (soccer)", "Sports", 0, 0], ["i10", "Ball (Tennis)", "Sports", 0, 0], ["i11", "Ball (Volleyball)", "Sports", 0, 0], ["i12", "Bandage", "Other", 0, 0], ["i13", "Battery AA", "Electronics", 0, 0], ["i14", "Battery AAA", "Electronics", 0, 0], ["i15", "Bleach", "Cleaning", 0, 0], ["i16", "Blue Glue tech", "Stationery", 0, 0], ["i17", "Bristol board", "Craft & Art", 9, 9], ["i18", "Bristol board Red", "Craft & Art", 40, 40], ["i19", "Broom (Fihigandu)", "Cleaning", 0, 0], ["i20", "Brush Toilet", "Craft & Art", 0, 0], ["i21", "Bucket", "Other", 0, 0], ["i22", "Calculator", "Other", 1, 1], ["i23", "Cartridge HP 79A", "Other", 2, 2], ["i24", "Cartridge HP 85A", "Other", 1, 1], ["i25", "Cartridge Konica", "Other", 1, 1], ["i26", "Cartridge Canon ir1020", "Other", 1, 1], ["i27", "Cellophane tape 48mm", "Stationery", 4, 4], ["i28", "Cellophane tape 36mm", "Stationery", 14, 14], ["i29", "Cellophane tape 24mm", "Stationery", 8, 8], ["i30", "Celophane", "Other", 0, 0], ["i31", "Clip board", "Stationery", 12, 12], ["i32", "Comb 25mm", "Other", 0, 0], ["i33", "Copy paper", "Stationery", 0, 0], ["i34", "Cutter Small", "Stationery", 18, 18], ["i35", "Cutter big", "Stationery", 15, 15], ["i36", "Cutter Blade Big", "Stationery", 14, 14], ["i37", "Cutter Blade Small", "Stationery", 22, 22], ["i38", "Cutting mat 15*10", "Other", 0, 0], ["i39", "Cutting mat 18*12", "Other", 6, 6], ["i40", "Double Tape 24mm", "Stationery", 0, 0], ["i41", "Double Tape 12mm", "Stationery", 3, 3], ["i42", "Double Tape 6mm", "Stationery", 0, 0], ["i43", "Dustbin big", "Other", 0, 0], ["i44", "Dustbin small", "Other", 3, 3], ["i45", "Duster", "Cleaning", 0, 0], ["i46", "Door Lock", "Other", 0, 0], ["i47", "Energy light", "Other", 0, 0], ["i48", "Energy save bulb ( happy)", "Electronics", 0, 0], ["i49", "Energy save light (philips)", "Other", 0, 0], ["i50", "Energy save light", "Other", 0, 0], ["i51", "Envelop A4 size", "Stationery", 40, 40], ["i52", "Envelop A5 size", "Stationery", 196, 196], ["i53", "Envelop Nomal #10", "Stationery", 188, 188], ["i54", "Envelop Small", "Stationery", 101, 101], ["i55", "Eraser", "Stationery", 186, 186], ["i56", "Exam Pad", "Stationery", 8, 8], ["i57", "Fan Usha 56\"", "Other", 0, 0], ["i58", "File Box 2\"", "Stationery", 45, 45], ["i59", "File Punch", "Stationery", 317, 317], ["i60", "File pocket", "Stationery", 55, 55], ["i61", "Floor Cleaner", "Other", 0, 0], ["i62", "Floor Cleaner big", "Other", 0, 0], ["i63", "Glass (drink)", "Other", 0, 0], ["i64", "Glue large", "Stationery", 6, 6], ["i65", "Glue medium", "Stationery", 4, 4], ["i66", "Glue small", "Stationery", 33, 33], ["i67", "Graph Book", "Other", 46, 46], ["i68", "High lighter", "Other", 0, 0], ["i69", "Holhiburi", "Other", 0, 0], ["i70", "Jersy blue", "Other", 0, 0], ["i71", "Jersy red", "Other", 0, 0], ["i72", "Justugandu", "Other", 0, 0], ["i73", "Kafa Roll", "Other", 0, 0], ["i74", "Kunikahaa Dhathi", "Other", 0, 0], ["i75", "Laminate pouch", "Other", 300, 300], ["i76", "Leaf Rake", "Other", 0, 0], ["i77", "Log Book 200", "Stationery", 0, 0], ["i78", "Log Book 300", "Stationery", 1, 1], ["i79", "Log Book 400", "Stationery", 27, 27], ["i80", "Log Book 500", "Stationery", 8, 8], ["i81", "Mama lemon", "Other", 0, 0], ["i82", "Marker White board Black", "Stationery", 0, 0], ["i83", "Marker White board Blue", "Stationery", 0, 0], ["i84", "Marker White board Red", "Stationery", 25, 25], ["i85", "Monitor Book 120", "Other", 0, 0], ["i86", "Monitor Book 200", "Other", 0, 0], ["i87", "Monitor Book 300", "Other", 3, 3], ["i88", "Monitor Book 400", "Other", 5, 5], ["i89", "Monitor Book 500", "Other", 0, 0], ["i90", "Mop", "Cleaning", 0, 0], ["i91", "Mop set", "Cleaning", 0, 0], ["i92", "Mug (tea)", "Other", 0, 0], ["i93", "Notice board", "Stationery", 0, 0], ["i94", "Paper clip", "Stationery", 33, 33], ["i95", "Pen black", "Stationery", 100, 100], ["i96", "Pen Blue", "Stationery", 100, 100], ["i97", "Pen Red", "Stationery", 75, 75], ["i98", "Pencil", "Stationery", 145, 145], ["i99", "Pin", "Other", 28, 28], ["i100", "Puncher Dp700 2 hole", "Stationery", 0, 0], ["i101", "Ruler 6\"", "Other", 2, 2], ["i102", "Sharpener", "Stationery", 110, 110], ["i103", "Sheltex", "Other", 0, 0], ["i104", "Soap", "Cleaning", 0, 0], ["i105", "Soap Liquid", "Cleaning", 0, 0], ["i106", "Softner", "Other", 0, 0], ["i107", "Soklin", "Other", 0, 0], ["i108", "Soklin OMO", "Other", 0, 0], ["i109", "Sponge", "Other", 0, 0], ["i110", "Stapler mini", "Stationery", 0, 0], ["i111", "Stapler Normal", "Stationery", 7, 7], ["i112", "Stapler Large", "Stationery", 3, 3], ["i113", "Staples Medium no: 26", "Stationery", 0, 0], ["i114", "Staples Normal no:10", "Stationery", 12, 12], ["i115", "Steel Wool", "Craft & Art", 0, 0], ["i116", "Swim Goggles", "Other", 0, 0], ["i117", "Swim Kick board", "Stationery", 0, 0], ["i118", "Tape Dispenser", "Stationery", 0, 0], ["i119", "Tipex", "Other", 0, 0], ["i120", "Tissue Box", "Other", 0, 0], ["i121", "Tissue Pkt", "Other", 0, 0], ["i122", "Toner (Canon MB500) - Magenta", "Other", 1, 1], ["i123", "Toner (Canon MB500) - Yellow", "Other", 1, 1], ["i124", "Toner (Canon MB500) - Blue", "Other", 1, 1], ["i125", "Toner (Canon MB500) - Black", "Other", 2, 2], ["i126", "Trophy L", "Other", 0, 0], ["i127", "Trophy M", "Other", 0, 0], ["i128", "Trophy S", "Other", 0, 0], ["i129", "Vim", "Other", 0, 0], ["i130", "Cartridge Canon ir2525", "Other", 1, 1], ["i131", "Water pipe", "Other", 0, 0], ["i132", "Window Cleaner", "Other", 0, 0], ["i133", "Wings Cleaner", "Other", 0, 0], ["i134", "Wings Cleaner s", "Other", 0, 0], ["i135", "Permernent marker black", "Stationery", 0, 0], ["i136", "Permernent marker blue", "Stationery", 23, 23], ["i137", "Pencil sharpner (large)", "Stationery", 0, 0], ["i138", "Ball (foot sel)", "Sports", 0, 0], ["i139", "Desk s", "Furniture", 0, 0], ["i140", "Certificate paper", "Stationery", 136, 136], ["i141", "Pin color set new", "Craft & Art", 0, 0], ["i142", "Stickers", "Other", 30, 30], ["i143", "Wheel baro", "Other", 0, 0], ["i144", "Air Pump", "Other", 0, 0], ["i145", "Tree Cutter s", "Stationery", 0, 0], ["i146", "Tree Cutter big", "Stationery", 0, 0], ["i147", "Fai fuhi", "Other", 0, 0], ["i148", "Justugandu (aiganduli)", "Other", 0, 0], ["i149", "Mashandhathi", "Other", 0, 0], ["i150", "Screw normal", "Other", 0, 0], ["i151", "Screw (toilet)", "Other", 0, 0], ["i152", "Cartridge Pixma 89 Black", "Other", 4, 4], ["i153", "Three pin", "Other", 0, 0], ["i154", "Extention Cables", "Electronics", 0, 0], ["i155", "Water Tag Screw", "Other", 0, 0], ["i156", "Moskito Repalant Machine", "Other", 0, 0], ["i157", "Moskito Repalant refill", "Other", 0, 0], ["i158", "Fabric Colour Set (classic)", "Craft & Art", 0, 0], ["i159", "Pen (Florescent coloured)", "Craft & Art", 0, 0], ["i160", "Cartridge Pixma 99 Color", "Craft & Art", 2, 2], ["i161", "Ribbon (decorative)", "Craft & Art", 0, 0], ["i162", "Staples (Large size) -26/8", "Stationery", 0, 0], ["i163", "Foam board", "Craft & Art", 3, 3], ["i164", "Pencil holder", "Stationery", 2, 2], ["i165", "Stickey note", "Other", 13, 13], ["i166", "Pencil colours", "Craft & Art", 19, 19], ["i167", "Acrylic colours (500ml,250ml)", "Craft & Art", 22, 22], ["i168", "Sanitizer", "Other", 0, 0], ["i169", "Calendar", "Other", 0, 0], ["i170", "Glace paper", "Stationery", 50, 50], ["i171", "Stamp", "Other", 0, 0], ["i172", "Jotter book", "Other", 12, 12], ["i173", "Scrap book", "Other", 13, 13], ["i174", "Exercise book SINGLE 80P A5", "Other", 13, 13], ["i175", "Exercise book DOUBLE 80P A5", "Other", 0, 0], ["i176", "Scissors", "Stationery", 34, 34], ["i177", "Modelling clay", "Craft & Art", 15, 15], ["i178", "Crayon", "Craft & Art", 61, 61], ["i179", "Water colour (Tube)", "Craft & Art", 45, 45], ["i180", "Drawing Block", "Stationery", 193, 193], ["i181", "Paint brush", "Craft & Art", 156, 156], ["i182", "Apron", "Other", 42, 42], ["i183", "Building blocks", "Other", 9, 9], ["i184", "Story book", "Other", 0, 0], ["i185", "Story book", "Other", 0, 0], ["i186", "Shape Wooden toys", "Other", 1, 1], ["i187", "Magnifying glass", "Other", 0, 0], ["i188", "Sand play Toys", "Other", 2, 2], ["i189", "Poster colour", "Craft & Art", 0, 0], ["i190", "Double Tape 36mm", "Stationery", 9, 9], ["i191", "Permenant marker (red)", "Stationery", 0, 0], ["i192", "Clear display book file", "Stationery", 10, 10], ["i193", "Sticker paper", "Stationery", 100, 100], ["i194", "Wood puzzle", "Other", 9, 9], ["i195", "Bristol paper", "Craft & Art", 0, 0], ["i196", "Kitchen toys set", "Other", 1, 1], ["i197", "White Board", "Stationery", 0, 0], ["i198", "White Board", "Stationery", 0, 0], ["i199", "Magnets", "Other", 0, 0], ["i200", "Lego set", "Other", 0, 0], ["i201", "Carpenter tool set", "Stationery", 0, 0], ["i202", "Animals set", "Other", 0, 0], ["i203", "Plant Pot", "Other", 0, 0], ["i204", "Plant Pot", "Other", 0, 0], ["i205", "Plant Pot", "Other", 0, 0], ["i206", "Wrapping paper (Parcel paper)", "Craft & Art", 0, 0], ["i207", "Wool roll", "Craft & Art", 5, 5], ["i208", "Cleaning toy set", "Other", 1, 1], ["i209", "Mirror", "Other", 0, 0], ["i210", "Glue Stick", "Stationery", 58, 58], ["i211", "Water colour (Bottle)", "Craft & Art", 8, 8], ["i212", "Geometrical box", "Other", 3, 3], ["i213", "Ruler 12\"", "Other", 10, 10], ["i214", "Book (Double ruled) - 200", "Other", 3, 3], ["i215", "Book (Square ruled) - 80", "Other", 3, 3], ["i216", "Book (Double ruled) - 80", "Other", 16, 16], ["i217", "Book (Square ruled) - 200", "Other", 6, 6], ["i218", "Number toy set", "Other", 1, 1], ["i219", "Doctor toy set", "Other", 2, 2], ["i220", "Cellophane tape 12mm", "Stationery", 10, 10], ["i221", "Masking tape 48mm", "Stationery", 6, 6], ["i222", "Bristol board Pink", "Craft & Art", 19, 19], ["i223", "Bristol board Purple", "Craft & Art", 0, 0], ["i224", "Bristol board Orange", "Craft & Art", 15, 15], ["i225", "Bristol board L.Green", "Craft & Art", 0, 0], ["i226", "Bristol board L.Purple", "Craft & Art", 0, 0], ["i227", "Bristol board D.Green", "Craft & Art", 0, 0], ["i228", "Bristol board Yellow", "Craft & Art", 5, 5], ["i229", "Bristol board L.Blue", "Craft & Art", 5, 5], ["i230", "File Box 3\"", "Stationery", 11, 11], ["i231", "Binding comb a4 (small)", "Stationery", 56, 56], ["i232", "Binding comb a4 (medium)", "Stationery", 47, 47], ["i233", "Binding comb a4 (large)", "Stationery", 1, 1], ["i234", "Scrabbles set", "Other", 3, 3], ["i235", "Binder clip", "Stationery", 2, 2], ["i236", "UHU glue", "Stationery", 11, 11], ["i237", "Bristol board Black", "Craft & Art", 10, 10], ["i238", "Glitter paper", "Stationery", 16, 16], ["i239", "Crape paper", "Stationery", 50, 50], ["i240", "Gardening toy set", "Other", 1, 1], ["i241", "Balloon Pack", "Sports", 0, 0]];

function doGet(e) {
  return respond(getAllData());
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;
  var payload = body.payload || {};

  if (action === 'addItem') addItem(payload);
  else if (action === 'deleteItem') deleteItemById(payload.id);
  else if (action === 'issue') issueStock(payload);

  return respond(getAllData());
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheets() {
  var ss = getSS();
  var itemsSheet = ss.getSheetByName(ITEMS_SHEET);
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet(ITEMS_SHEET);
    itemsSheet.appendRow(['id', 'name', 'category', 'totalQty', 'availableQty']);
  }
  var logSheet = ss.getSheetByName(LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(LOG_SHEET);
    logSheet.appendRow(['id', 'itemId', 'itemName', 'takenBy', 'role', 'qty', 'dateIssued']);
  }
  return { itemsSheet: itemsSheet, logSheet: logSheet };
}

// Run this once manually from the Apps Script editor to set up the sheets.
function seedItemsIfEmpty() {
  var sheets = ensureSheets();
  var itemsSheet = sheets.itemsSheet;
  if (itemsSheet.getLastRow() > 1) {
    Logger.log('App_Items already has data — skipping seed.');
    return;
  }
  var rows = SEED_ROWS.filter(function (r) { return r[3] > 0 || r[4] > 0 || true; });
  if (rows.length > 0) {
    itemsSheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }
  Logger.log('Seeded ' + rows.length + ' items.');
}

function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row[0] === '' || row[0] === null) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function getAllData() {
  var sheets = ensureSheets();
  var items = sheetToObjects(sheets.itemsSheet).map(function (r) {
    return {
      id: String(r.id),
      name: r.name,
      category: r.category,
      totalQty: Number(r.totalQty) || 0,
      availableQty: Number(r.availableQty) || 0,
    };
  });
  var log = sheetToObjects(sheets.logSheet).map(function (r) {
    return {
      id: String(r.id),
      itemId: String(r.itemId),
      itemName: r.itemName,
      takenBy: r.takenBy,
      role: r.role,
      qty: Number(r.qty) || 0,
      dateIssued: r.dateIssued,
    };
  }).reverse(); // newest first
  return { items: items, log: log };
}

function addItem(payload) {
  var sheets = ensureSheets();
  sheets.itemsSheet.appendRow([
    payload.id, payload.name, payload.category, payload.totalQty, payload.availableQty,
  ]);
}

function deleteItemById(id) {
  var sheets = ensureSheets();
  var values = sheets.itemsSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheets.itemsSheet.deleteRow(i + 1);
      break;
    }
  }
}

// payload: { takenBy, role, date, lines: [{ itemId, qty }] }
function issueStock(payload) {
  var sheets = ensureSheets();
  var values = sheets.itemsSheet.getDataRange().getValues();
  var idCol = 0, nameCol = 1, availCol = 4;

  payload.lines.forEach(function (line) {
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(line.itemId)) {
        var currentAvail = Number(values[i][availCol]) || 0;
        var newAvail = Math.max(0, currentAvail - Number(line.qty));
        sheets.itemsSheet.getRange(i + 1, availCol + 1).setValue(newAvail);
        values[i][availCol] = newAvail; // keep local copy in sync for repeated itemIds in one batch

        sheets.logSheet.appendRow([
          Utilities.getUuid(),
          line.itemId,
          values[i][nameCol],
          payload.takenBy,
          payload.role,
          line.qty,
          payload.date,
        ]);
        break;
      }
    }
  });
}
