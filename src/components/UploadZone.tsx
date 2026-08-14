/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, HelpCircle, CheckCircle2, Download } from 'lucide-react';
import { Guest, Table, MappingOptions } from '../types';

interface UploadZoneProps {
  onDataLoaded: (guests: Guest[], tables: Table[], append: boolean) => void;
  existingTablesCount: number;
  defaultTableShape?: 'round' | 'rectangle' | 'square' | 'banquet' | 'banana' | 'nano' | 'custom' | 'seminar';
  defaultTableSeats?: number;
  arenaMode?: 'dining' | 'lecture';
}

export default function UploadZone({ 
  onDataLoaded, 
  existingTablesCount,
  defaultTableShape = 'round',
  defaultTableSeats = 8,
  arenaMode = 'dining',
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [mapping, setMapping] = useState<MappingOptions>({
    nameColumn: '',
    tableColumn: '',
    seatColumn: '',
    groupColumn: '',
    notesColumn: '',
  });
  const [appendMode, setAppendMode] = useState<boolean>(false);
  const [isMappingMode, setIsMappingMode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [importFormat, setImportFormat] = useState<'standard' | 'column_tables'>('column_tables');
  
  const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const hasLoadedFromSession = useRef<boolean>(false);

  // Prevent default drag and drop on the window to prevent accidental page navigations or refreshes
  React.useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // Load from sessionStorage on mount
  React.useEffect(() => {
    const cachedRows = sessionStorage.getItem('seating_planner_temp_rows');
    const cachedHeaders = sessionStorage.getItem('seating_planner_temp_headers');
    const cachedFileName = sessionStorage.getItem('seating_planner_temp_filename');
    const cachedMapping = sessionStorage.getItem('seating_planner_temp_mapping');
    const cachedFormat = sessionStorage.getItem('seating_planner_temp_format');
    const cachedIsMapping = sessionStorage.getItem('seating_planner_temp_is_mapping');
    const cachedRawGrid = sessionStorage.getItem('seating_planner_temp_raw_grid');
    const cachedHeaderIdx = sessionStorage.getItem('seating_planner_temp_header_idx');

    if (cachedRows && cachedHeaders && cachedIsMapping === 'true') {
      try {
        setParsedRows(JSON.parse(cachedRows));
        setHeaders(JSON.parse(cachedHeaders));
        if (cachedFileName) setFileName(cachedFileName);
        if (cachedMapping) setMapping(JSON.parse(cachedMapping));
        if (cachedFormat) setImportFormat(cachedFormat as any);
        if (cachedRawGrid) setRawGrid(JSON.parse(cachedRawGrid));
        if (cachedHeaderIdx) setHeaderRowIndex(Number(cachedHeaderIdx));
        setIsMappingMode(true);
      } catch (e) {
        console.error("Error reading temporary session upload data:", e);
      }
    }
    hasLoadedFromSession.current = true;
  }, []);

  // Save to sessionStorage on change
  React.useEffect(() => {
    if (!hasLoadedFromSession.current) return;

    if (isMappingMode && parsedRows && headers.length > 0) {
      sessionStorage.setItem('seating_planner_temp_rows', JSON.stringify(parsedRows));
      sessionStorage.setItem('seating_planner_temp_headers', JSON.stringify(headers));
      sessionStorage.setItem('seating_planner_temp_filename', fileName);
      sessionStorage.setItem('seating_planner_temp_mapping', JSON.stringify(mapping));
      sessionStorage.setItem('seating_planner_temp_format', importFormat);
      sessionStorage.setItem('seating_planner_temp_is_mapping', 'true');
      if (rawGrid) {
        sessionStorage.setItem('seating_planner_temp_raw_grid', JSON.stringify(rawGrid));
      }
      sessionStorage.setItem('seating_planner_temp_header_idx', String(headerRowIndex));
    } else {
      sessionStorage.removeItem('seating_planner_temp_rows');
      sessionStorage.removeItem('seating_planner_temp_headers');
      sessionStorage.removeItem('seating_planner_temp_filename');
      sessionStorage.removeItem('seating_planner_temp_mapping');
      sessionStorage.removeItem('seating_planner_temp_format');
      sessionStorage.removeItem('seating_planner_temp_is_mapping');
      sessionStorage.removeItem('seating_planner_temp_raw_grid');
      sessionStorage.removeItem('seating_planner_temp_header_idx');
    }
  }, [isMappingMode, parsedRows, headers, fileName, mapping, importFormat, rawGrid, headerRowIndex]);

  const processRawGrid = (grid: any[][], headerRowIdx: number) => {
    if (!grid || grid.length <= headerRowIdx) {
      return { headers: [], parsedRows: [] };
    }

    const headerRow = grid[headerRowIdx] || [];
    const seenHeaders = new Set<string>();
    const headersList: string[] = [];

    headerRow.forEach((val, idx) => {
      let cleanVal = val !== undefined && val !== null ? String(val).trim() : '';
      if (!cleanVal) {
        cleanVal = `Column_${idx + 1}`;
      }
      
      let uniqueName = cleanVal;
      let count = 2;
      while (seenHeaders.has(uniqueName)) {
        uniqueName = `${cleanVal}_${count}`;
        count++;
      }
      seenHeaders.add(uniqueName);
      headersList.push(uniqueName);
    });

    const dataRows = grid.slice(headerRowIdx + 1);
    const parsed = dataRows.map((row) => {
      const obj: Record<string, any> = {};
      headersList.forEach((header, idx) => {
        const val = row[idx];
        obj[header] = val !== undefined && val !== null ? val : '';
      });
      return obj;
    }).filter(row => {
      return Object.values(row).some(v => String(v).trim() !== '');
    });

    return { headers: headersList, parsedRows: parsed };
  };

  const handleHeaderRowChange = (newIndex: number) => {
    setHeaderRowIndex(newIndex);
    if (rawGrid) {
      const { headers: foundHeaders, parsedRows: rows } = processRawGrid(rawGrid, newIndex);
      setParsedRows(rows);
      setHeaders(foundHeaders);
      
      const hasStandardNameHeader = foundHeaders.some(h => 
        /name|guest|fullname|person|label|first|last/i.test(h.trim())
      );
      const hasTableLikeHeaders = foundHeaders.some(h => 
        /^(#|table\s*\d+|\s*\d+|t\s*\d+)$/i.test(h.trim())
      );

      if (hasTableLikeHeaders && !hasStandardNameHeader) {
        setImportFormat('column_tables');
      } else {
        setImportFormat('standard');
      }

      autoSuggestMapping(foundHeaders);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setErrorMsg('');

    // RF-05: Client-side file size limit check (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File too large. Please upload files under 10 MB.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const grid = results.data as any[][];
            setRawGrid(grid);
            setHeaderRowIndex(0);

            const { headers: foundHeaders, parsedRows: rows } = processRawGrid(grid, 0);
            setParsedRows(rows);
            setHeaders(foundHeaders);
            
            const hasStandardNameHeader = foundHeaders.some(h => 
              /name|guest|fullname|person|label|first|last/i.test(h.trim())
            );
            const hasTableLikeHeaders = foundHeaders.some(h => 
              /^(#|table\s*\d+|\s*\d+|t\s*\d+)$/i.test(h.trim())
            );

            if (hasTableLikeHeaders && !hasStandardNameHeader) {
              setImportFormat('column_tables');
            } else {
              setImportFormat('standard');
            }

            autoSuggestMapping(foundHeaders);
            setIsMappingMode(true);
          } else {
            setErrorMsg('The CSV file is empty.');
          }
        },
        error: (err) => {
          setErrorMsg(`Error parsing CSV: ${err.message}`);
        }
      });
    } else if (['xlsx', 'xls'].includes(extension || '')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (grid.length > 0) {
            setRawGrid(grid);
            setHeaderRowIndex(0);

            const { headers: foundHeaders, parsedRows: rows } = processRawGrid(grid, 0);
            setParsedRows(rows);
            setHeaders(foundHeaders);

            const hasStandardNameHeader = foundHeaders.some(h => 
              /name|guest|fullname|person|label|first|last/i.test(h.trim())
            );
            const hasTableLikeHeaders = foundHeaders.some(h => 
              /^(#|table\s*\d+|\s*\d+|t\s*\d+)$/i.test(h.trim())
            );

            if (hasTableLikeHeaders && !hasStandardNameHeader) {
              setImportFormat('column_tables');
            } else {
              setImportFormat('standard');
            }

            autoSuggestMapping(foundHeaders);
            setIsMappingMode(true);
          } else {
            setErrorMsg('The Excel file is empty.');
          }
        } catch (err) {
          setErrorMsg('Failed to parse Excel file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setErrorMsg('Unsupported file format. Please upload a .csv, .xlsx, or .xls file.');
    }
  };

  const autoSuggestMapping = (foundHeaders: string[]) => {
    const findMatch = (candidates: string[]) => {
      const match = foundHeaders.find(h => 
        candidates.some(c => h.toLowerCase().replace(/[\s_-]/g, '').includes(c))
      );
      return match || '';
    };

    setMapping({
      nameColumn: findMatch(['name', 'guest', 'fullname', 'person', 'label']),
      emailColumn: findMatch(['email', 'e-mail', 'mail', 'emailaddress', 'address']),
      tableColumn: findMatch(['table', 'tablenum', 'tableno', 'grouping']),
      seatColumn: findMatch(['seat', 'placement', 'chair', 'seatnum']),
      groupColumn: findMatch(['group', 'family', 'company', 'companyname', 'organization', 'party', 'affiliation']),
      notesColumn: findMatch(['note', 'diet', 'dietary', 'comment', 'restriction', 'allergy']),
    });
  };

  const handleImport = () => {
    if (!parsedRows) {
      setErrorMsg('No data parsed to import.');
      return;
    }

    const tableColors = [
      '#4F46E5', // Indigo
      '#059669', // Emerald
      '#DC2626', // Red
      '#D97706', // Amber
      '#2563EB', // Blue
      '#9333EA', // Purple
      '#0891B2', // Cyan
      '#DB2777', // Pink
    ];

    if (importFormat === 'column_tables') {
      // Column-per-Table format triggers:
      // Each column is parsed as a table, and each cell in that column is parsed as a guest at that table
      const guests: Guest[] = [];
      const tableMap = new Map<string, Table>();
      const isLecture = arenaMode === 'lecture';

      headers.forEach((header, colIndex) => {
        const headerClean = String(header).trim();
        if (!headerClean) return;

        // Clean table designation and key
        const numMatch = headerClean.match(/\d+/);
        const tableId = numMatch ? `table_${numMatch[0]}` : `table_${headerClean.toLowerCase().replace(/\s+/g, '_')}`;
        const tableName = headerClean.startsWith('#') || headerClean.toLowerCase().startsWith('table') 
          ? headerClean 
          : isLecture ? `Row Segment ${headerClean}` : `Table ${headerClean}`;

        // Determine number of non-empty guests in this column
        let numGuestsInCol = 0;
        parsedRows.forEach((row) => {
          const val = row[header];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            numGuestsInCol++;
          }
        });

        const seatsPerRow = 8;
        const sRows = Math.max(1, Math.ceil(numGuestsInCol / seatsPerRow));
        const maxSeats = isLecture ? sRows * seatsPerRow : defaultTableSeats;

        tableMap.set(tableId, {
          id: tableId,
          name: tableName,
          maxSeats: maxSeats,
          shape: isLecture ? 'seminar' : defaultTableShape,
          color: isLecture ? '#4F46E5' : tableColors[tableMap.size % tableColors.length],
          seminarRows: isLecture ? sRows : undefined,
          seminarSeatsPerRow: isLecture ? seatsPerRow : undefined,
          seminarDirection: isLecture ? 'Top' : undefined,
          scale: 1.0,
        });

        let seatIdx = 0;
        parsedRows.forEach((row, rowIndex) => {
          const val = row[header];
          if (val !== undefined && val !== null) {
            const guestName = String(val).trim();
            if (guestName) {
              const emailPrefix = guestName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');
              const fakeEmail = `${emailPrefix || 'guest'}@example.com`;

              guests.push({
                id: `guest_imported_${Date.now()}_col_${colIndex}_row_${rowIndex}`,
                name: guestName,
                email: fakeEmail,
                tableId,
                seatIndex: seatIdx++,
                group: tableName, // Set group automatically to identify them as sitting together!
                notes: '',
              });
            }
          }
        });

        // Expand maxSeats if more guests are seated than standard starting capacity
        const tbl = tableMap.get(tableId);
        if (tbl) {
          if (isLecture) {
            const finalSRows = Math.max(1, Math.ceil(seatIdx / seatsPerRow));
            tbl.seminarRows = finalSRows;
            tbl.seminarSeatsPerRow = seatsPerRow;
            tbl.maxSeats = finalSRows * seatsPerRow;
          } else if (seatIdx > tbl.maxSeats) {
            tbl.maxSeats = Math.ceil(seatIdx / 2) * 2; // round up to even
          }
        }
      });

      onDataLoaded(guests, Array.from(tableMap.values()), appendMode);

      // RF-07: Clear temporary upload data from sessionStorage
      sessionStorage.removeItem('seating_planner_temp_rows');
      sessionStorage.removeItem('seating_planner_temp_headers');
      sessionStorage.removeItem('seating_planner_temp_filename');
      sessionStorage.removeItem('seating_planner_temp_mapping');
      sessionStorage.removeItem('seating_planner_temp_format');
      sessionStorage.removeItem('seating_planner_temp_is_mapping');
      sessionStorage.removeItem('seating_planner_temp_raw_grid');
      sessionStorage.removeItem('seating_planner_temp_header_idx');

      // Reset state
      setParsedRows(null);
      setHeaders([]);
      setFileName('');
      setIsMappingMode(false);
      setRawGrid(null);
      setHeaderRowIndex(0);
      return;
    }

    // Otherwise standard mode:
    if (!mapping.nameColumn) {
      setErrorMsg('Please select at least the Guest Name column.');
      return;
    }

    const guests: Guest[] = [];
    const tableMap = new Map<string, Table>();
    const isLecture = arenaMode === 'lecture';

    // Helper to extract a table number or string
    const getCleanTableIdAndName = (rawVal: any) => {
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        return null;
      }
      const rawStr = String(rawVal).trim();
      const numMatch = rawStr.match(/\d+/);
      const id = numMatch ? `table_${numMatch[0]}` : `table_${rawStr.toLowerCase().replace(/\s+/g, '_')}`;
      const name = rawStr.toLowerCase().startsWith('table') || rawStr.toLowerCase().startsWith('row') || rawStr.startsWith('#')
        ? rawStr 
        : isLecture ? `Row Segment ${rawStr}` : `Table ${rawStr}`;
      return { id, name, displayNum: numMatch ? parseInt(numMatch[0]) : 1 };
    };

    parsedRows.forEach((row, index) => {
      const name = String(row[mapping.nameColumn] || '').trim();
      if (!name) return; // skip rows without a name

      const rawEmailVal = mapping.emailColumn ? String(row[mapping.emailColumn] || '').trim() : '';
      const emailPrefix = name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');
      const email = rawEmailVal || `${emailPrefix || 'guest'}@example.com`;

      const rawTableVal = mapping.tableColumn ? row[mapping.tableColumn] : null;
      const cleanTable = getCleanTableIdAndName(rawTableVal);

      let tableId: string | null = null;
      if (cleanTable) {
        tableId = cleanTable.id;
        if (!tableMap.has(tableId)) {
          tableMap.set(tableId, {
            id: tableId,
            name: cleanTable.name,
            maxSeats: isLecture ? 8 : defaultTableSeats,
            shape: isLecture ? 'seminar' : defaultTableShape,
            color: isLecture ? '#4F46E5' : tableColors[tableMap.size % tableColors.length],
            seminarRows: isLecture ? 1 : undefined,
            seminarSeatsPerRow: isLecture ? 8 : undefined,
            seminarDirection: isLecture ? 'Top' : undefined,
            scale: 1.0,
          });
        }
      }

      const rawSeatVal = mapping.seatColumn ? parseInt(row[mapping.seatColumn]) : null;
      const seatIndex = (rawSeatVal !== null && !isNaN(rawSeatVal)) ? rawSeatVal - 1 : null;

      const group = mapping.groupColumn ? String(row[mapping.groupColumn] || '').trim() : 'Individual';
      const notes = mapping.notesColumn ? String(row[mapping.notesColumn] || '').trim() : '';

      guests.push({
        id: `guest_imported_${Date.now()}_${index}`,
        name,
        email,
        tableId,
        seatIndex: tableId ? (seatIndex !== null ? seatIndex : null) : null,
        group: group || 'Individual',
        notes,
      });
    });

    const tablesList = Array.from(tableMap.values());
    
    tablesList.forEach((t) => {
      const tableGuests = guests.filter((g) => g.tableId === t.id);
      
      if (isLecture) {
        const seatsPerRow = 8;
        const sRows = Math.max(1, Math.ceil(tableGuests.length / seatsPerRow));
        t.seminarRows = sRows;
        t.seminarSeatsPerRow = seatsPerRow;
        t.maxSeats = sRows * seatsPerRow;
      } else if (tableGuests.length > t.maxSeats) {
        t.maxSeats = Math.ceil(tableGuests.length / 2) * 2;
      }

      const usedSeats = new Set<number>();
      tableGuests.forEach((g) => {
        if (g.seatIndex !== null && g.seatIndex >= 0 && g.seatIndex < t.maxSeats && !usedSeats.has(g.seatIndex)) {
          usedSeats.add(g.seatIndex);
        } else {
          g.seatIndex = null;
        }
      });

      tableGuests.forEach((g) => {
        if (g.seatIndex === null) {
          for (let s = 0; s < t.maxSeats; s++) {
            if (!usedSeats.has(s)) {
              g.seatIndex = s;
              usedSeats.add(s);
              break;
            }
          }
          if (g.seatIndex === null) {
            if (isLecture) {
              t.seminarRows = (t.seminarRows || 1) + 1;
              t.maxSeats = t.seminarRows * (t.seminarSeatsPerRow || 8);
              g.seatIndex = t.maxSeats - (t.seminarSeatsPerRow || 8);
              usedSeats.add(g.seatIndex);
            } else {
              t.maxSeats += 2;
              g.seatIndex = t.maxSeats - 2;
              usedSeats.add(g.seatIndex);
            }
          }
        }
      });
    });

    onDataLoaded(guests, tablesList, appendMode);
    
    // RF-07: Clear temporary upload data from sessionStorage
    sessionStorage.removeItem('seating_planner_temp_rows');
    sessionStorage.removeItem('seating_planner_temp_headers');
    sessionStorage.removeItem('seating_planner_temp_filename');
    sessionStorage.removeItem('seating_planner_temp_mapping');
    sessionStorage.removeItem('seating_planner_temp_format');
    sessionStorage.removeItem('seating_planner_temp_is_mapping');
    sessionStorage.removeItem('seating_planner_temp_raw_grid');
    sessionStorage.removeItem('seating_planner_temp_header_idx');

    // Reset state
    setParsedRows(null);
    setHeaders([]);
    setFileName('');
    setIsMappingMode(false);
    setRawGrid(null);
    setHeaderRowIndex(0);
  };

  const downloadStandardTemplate = () => {
    const csvContent = "Guest Name,Email,Table Number,Seat Number,Group/Affiliation,Notes/Dietary\n" +
      "Amelia Earhart,amelia.earhart@example.com,Table 1,1,Aviation Pioneers,Vegetarian\n" +
      "Charles Lindbergh,charles.lindbergh@example.com,Table 1,2,Aviation Pioneers,\n" +
      "Orville Wright,orville.wright@example.com,Table 1,3,Aviation Pioneers,\n" +
      "Wilbur Wright,wilbur.wright@example.com,Table 1,4,Aviation Pioneers,\n" +
      "Isaac Newton,isaac.newton@example.com,Table 2,1,Science Club,Nut allergy\n" +
      "Albert Einstein,albert.einstein@example.com,Table 2,2,Science Club,\n" +
      "Marie Curie,marie.curie@example.com,Table 2,3,Science Club,VIP guest\n" +
      "Richard Feynman,richard.feynman@example.com,Table 2,4,Science Club,\n" +
      "Leonardo da Vinci,leonardo.davinci@example.com,, ,Artists,Gluten-free";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "standard_seating_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadColumnTablesTemplate = () => {
    const csvContent = "#1,#2,#3,#4\n" +
      "Amelia Earhart,Isaac Newton,Leonardo da Vinci,Winston Churchill\n" +
      "Charles Lindbergh,Albert Einstein,Marie Curie,Franklin D. Roosevelt\n" +
      "Orville Wright,Richard Feynman,,Theodore Roosevelt\n" +
      "Wilbur Wright,,,";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "column_tables_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900 tracking-tight">Import Guests List</h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Upload a CSV or Excel spreadsheet to start</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadColumnTablesTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Download size={14} />
            <span>Tables-as-Columns Template</span>
          </button>
          <button
            onClick={downloadStandardTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Download size={14} />
            <span>Standard Guest List Template</span>
          </button>
        </div>
      </div>

      {!isMappingMode ? (
        <div>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="pointer-events-none mx-auto w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
              <Upload size={20} className="text-gray-500" />
            </div>
            <p className="pointer-events-none text-sm font-medium text-gray-800">
              Drag &amp; drop your guest list here, or <span className="text-indigo-600 hover:underline">browse</span>
            </p>
            <p className="pointer-events-none text-xs text-gray-400 mt-1.5 font-mono">
              Supports CSV, XLSX, XLS sheets
            </p>
          </div>
          {errorMsg && (
            <p className="text-xs text-red-500 mt-2 font-mono text-left bg-red-50 p-2.5 rounded-lg border border-red-100">
              {errorMsg}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 bg-blue-50/50 border border-blue-100/60 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <HelpCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-700/80 leading-relaxed font-sans">
                <strong>Format Support Notice:</strong> We support both layout styles! You can import a standard guest list (with Name &amp; Table columns) OR a visual grid style layout where **the columns represent your tables** and each column lists the names of guests sitting there!
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="text-xs font-medium font-sans">
              Successfully parsed <strong>{parsedRows?.length} rows</strong> from <span className="font-mono">{fileName}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans">Spreadsheet Structure Style</label>
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit text-xs font-medium border border-gray-200/50">
              <button
                type="button"
                onClick={() => setImportFormat('column_tables')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  importFormat === 'column_tables' 
                    ? 'bg-white shadow-xs text-indigo-600 font-semibold border-b-2 border-indigo-600/30' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Columns as Tables (First row = #1, #2, ...)
              </button>
              <button
                type="button"
                onClick={() => setImportFormat('standard')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  importFormat === 'standard' 
                    ? 'bg-white shadow-xs text-indigo-600 font-semibold border-b-2 border-indigo-600/30' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Standard Guest List (One Guest per Row)
              </button>
            </div>
          </div>

          {rawGrid && rawGrid.length > 0 && (
            <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-100/60 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-indigo-950 uppercase tracking-wider font-sans">
                  {importFormat === 'column_tables' 
                    ? 'Choose Table Designation Row (Table Numbers/Names)' 
                    : 'Choose Table Headers Row'}
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded font-medium font-sans">Row Alignment</span>
              </div>
              <p className="text-xs text-indigo-800/80 font-sans leading-relaxed">
                {importFormat === 'column_tables'
                  ? 'Each column represents a table. Select the row containing your table numbers or names. The rows below this will contain guest names for that table:'
                  : 'Select the row containing your actual spreadsheet column headers (e.g., Guest Name, Table, Seat):'}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <select
                  value={headerRowIndex}
                  onChange={(e) => handleHeaderRowChange(Number(e.target.value))}
                  className="bg-white border border-indigo-200 text-indigo-900 rounded-lg p-2 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:max-w-md shrink-0 cursor-pointer"
                >
                  {rawGrid.slice(0, Math.min(15, rawGrid.length)).map((row, idx) => {
                    const rowPreview = row
                      .filter(val => val !== undefined && val !== null && String(val).trim() !== '')
                      .slice(0, 4)
                      .join(', ');
                    const rowLabel = rowPreview 
                      ? `Row ${idx + 1}: ${rowPreview.substring(0, 50)}${rowPreview.length > 50 ? '...' : ''}` 
                      : `Row ${idx + 1}: (Empty/Padding Row)`;
                    return (
                      <option key={idx} value={idx}>
                        {rowLabel}
                      </option>
                    );
                  })}
                </select>
                <span className="text-[10px] text-gray-400 font-mono">
                  (Showing first {Math.min(15, rawGrid.length)} rows)
                </span>
              </div>
            </div>
          )}

          {importFormat === 'column_tables' ? (
            <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider font-sans">Detected Tables &amp; Columns</h3>
                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-medium font-sans">Table Columns Layout</span>
              </div>
              <p className="text-xs text-amber-700 font-sans leading-normal">
                Your spreadsheet columns will be imported as separate tables. The names under each column will be seated at that table automatically:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-white rounded-lg border border-amber-100">
                {headers.map((h, i) => (
                  <div key={h} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    <span className="text-[10px] text-amber-600 font-bold font-mono">Col #{i+1}:</span>
                    <span className="font-mono">{h}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 font-sans">Map Spreadsheet Columns</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="block text-gray-600 font-medium font-sans">
                    Guest Name <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mapping.nameColumn}
                    onChange={(e) => setMapping({ ...mapping, nameColumn: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-gray-600 font-medium font-sans">
                    Table Designation (Optional)
                  </label>
                  <select
                    value={mapping.tableColumn}
                    onChange={(e) => setMapping({ ...mapping, tableColumn: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Let us auto-seat them --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-gray-600 font-medium font-sans">
                    Seat Number (Optional)
                  </label>
                  <select
                    value={mapping.seatColumn}
                    disabled={!mapping.tableColumn}
                    onChange={(e) => setMapping({ ...mapping, seatColumn: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">-- Auto-order seats --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-gray-600 font-medium font-sans">
                    Group / Relationship / Company (Optional)
                  </label>
                  <select
                    value={mapping.groupColumn}
                    onChange={(e) => setMapping({ ...mapping, groupColumn: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-gray-600 font-medium font-sans">
                    Dietary / Notes (Optional)
                  </label>
                  <select
                    value={mapping.notesColumn}
                    onChange={(e) => setMapping({ ...mapping, notesColumn: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs pt-2">
            {existingTablesCount > 0 && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-gray-700">
                  <input
                    type="radio"
                    name="importMode"
                    checked={!appendMode}
                    onChange={() => setAppendMode(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Replace existing {existingTablesCount} tables &amp; guests</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-gray-700">
                  <input
                    type="radio"
                    name="importMode"
                    checked={appendMode}
                    onChange={() => setAppendMode(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Merge / Append to current plan</span>
                </label>
              </div>
            )}

            <div className="flex items-center gap-2 justify-end grow">
              <button
                onClick={() => {
                  setParsedRows(null);
                  setHeaders([]);
                  setFileName('');
                  setIsMappingMode(false);
                  setRawGrid(null);
                  setHeaderRowIndex(0);
                }}
                className="px-4 py-2 text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-sans"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importFormat === 'standard' ? !mapping.nameColumn : headers.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 font-sans cursor-pointer animate-fade-in"
              >
                <span>Import Seating Data</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
