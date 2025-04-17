'use client';
import { toast } from "react-toastify";
import styles from "./page.module.css";
import { useState, useRef } from "react";

const toBinary = (num, bits) => num.toString(2).padStart(bits, '0');

const highlightBinary = (binaryStr, indexBits, offsetBits) => {
  return (
    <span>
      <span style={{ backgroundColor: '#e0f7fa' }}>
        {binaryStr.slice(0, indexBits)}
      </span>
      <span style={{ backgroundColor: '#ffe0b2' }}>
        {binaryStr.slice(indexBits)}
      </span>
    </span>
  );
};

const binaryToHex = (binaryStr) =>
  binaryStr
    .match(/.{1,4}/g)
    .map(bin => parseInt(bin, 2).toString(16).toUpperCase())
    .join('');

const hexToBinary = (hexStr, bits) =>
  parseInt(hexStr, 16).toString(2).padStart(bits, '0');

const handlePageReplacement = (updatedTable, virtualPage, fifoQueue, totalFrames) => {
  const loadedPages = updatedTable.filter(e => e.present);
  let newPhysicalIndex = '';
  if (loadedPages.length >= totalFrames) {
    const victimVirtualIndex = fifoQueue.current.shift();
    const victimIdx = updatedTable.findIndex(e =>
      parseInt(e.virtualIndex, 2) === victimVirtualIndex ||
      e.virtualIndex === toBinary(victimVirtualIndex, Math.floor(Math.log2(updatedTable.length)))
    );
    newPhysicalIndex = updatedTable[victimIdx].physicalIndex;
    updatedTable[victimIdx] = {
      ...updatedTable[victimIdx],
      present: false,
      physicalIndex: '',
      arrivalOrder: -1,
    };
    toast.success(`Page replacement performed using FIFO. Evicted page: ${victimVirtualIndex}`);
  } else {
    const nextFreeIndex = loadedPages.length;
    newPhysicalIndex = toBinary(nextFreeIndex, Math.floor(Math.log2(totalFrames)));
  }

  updatedTable[virtualPage] = {
    ...updatedTable[virtualPage],
    present: true,
    physicalIndex: newPhysicalIndex,
    arrivalOrder: fifoQueue.current.length,
  };
  fifoQueue.current.push(virtualPage);
  return { updatedTable, newPhysicalIndex };
};

export default function Home() {
  const [virtualSpace, setVirtualSpace] = useState(16);
  const [physicalSpace, setPhysicalSpace] = useState(8);
  const [pageSize, setPageSize] = useState(4);
  const [pageTable, setPageTable] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const dragStartIndex = useRef(null);
  const fifoQueue = useRef([]);
  
  const handleDragStart = (index) => {
    dragStartIndex.current = index;
  };
  
  const handleDrop = (dropIndex) => {
    const fromIndex = dragStartIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
  
    const updated = [...pageTable];
  
    const temp = { ...updated[fromIndex] };
    updated[fromIndex] = { ...updated[dropIndex], virtualIndex: updated[fromIndex].virtualIndex };
    updated[dropIndex] = { ...temp, virtualIndex: updated[dropIndex].virtualIndex };
  
    setPageTable(updated);
    dragStartIndex.current = null;
  };

  const generatePageTable = () => {
    if (virtualSpace > 0 && physicalSpace > 0 && pageSize > 0 && physicalSpace * 2 === virtualSpace) {
      const totalPages = virtualSpace / pageSize;
      const totalFrames = physicalSpace / pageSize;
      const offsetBits = Math.log2(pageSize * 1024);
      const virtualBits = Math.floor(Math.log2((virtualSpace * 1024) / (pageSize * 1024)) + offsetBits);
      const physicalBits = Math.floor(Math.log2((physicalSpace * 1024) / (pageSize * 1024)) + offsetBits);

      const generatedTable = Array.from({ length: totalPages }, (_, i) => {
        const virtualIndexBinary = toBinary(i, Math.floor(Math.log2(totalPages)));
        const physicalIndexBinary = i < totalFrames ? toBinary(i, Math.floor(Math.log2(totalFrames))) : '';
        return {
          virtualIndex: virtualIndexBinary,
          physicalIndex: physicalIndexBinary,
          present: i < totalFrames,
          arrivalOrder: i < totalFrames ? i : -1,
        };
      });
      setPageTable(generatedTable);
      fifoQueue.current = generatedTable.filter(e => e.present).map(e => parseInt(e.virtualIndex, 2));
    } else {
      toast.error("Ensure all sizes are valid and physical space is exactly half of virtual space.");
    }
  };

  const validateForm = () => {
    if (virtualSpace <= 0 || physicalSpace <= 0 || pageSize <= 0) {
      toast.error("All space values and page size must be greater than zero.");
      return false;
    }
    if (physicalSpace * 2 !== virtualSpace) {
      toast.error("Physical space must be half of virtual space.");
      return false;
    }
    for (let i = 0; i < pageTable.length; i++) {
      const entry = pageTable[i];
      if (
        entry.virtualIndex < 0 ||
        entry.physicalIndex < 0 ||
        isNaN(entry.virtualIndex) ||
        isNaN(entry.physicalIndex) ||
        entry.arrivalOrder < 0
      ) {
        toast.error(`Invalid values in page table at index ${i}`);
        return false;
      }
    }
    return true;
  };


  const showBinaryAddresses = () => {
    if (!validateForm()) return;
    const offsetBits = Math.log2(pageSize * 1024);
    const virtualBits = Math.log2(virtualSpace * 1024);
    const physicalBits = Math.log2(physicalSpace * 1024);

    const addressLog = pageTable.map(entry => {
      const virtualAddress = toBinary(entry.virtualIndex * pageSize * 1024, virtualBits);
      const physicalAddress = entry.present
        ? toBinary(entry.physicalIndex * pageSize * 1024, physicalBits)
        : 'Page Fault';

      return {
        virtualIndex: entry.virtualIndex,
        virtualAddress,
        physicalAddress
      };
    });

  };

  const handleChange = (i, field, value) => {
    const updated = [...pageTable];
    updated[i][field] = field === 'present' ? value.target.checked : Number(value.target.value);
    setPageTable(updated);
  };

  const [addressHex, setAddressHex] = useState('');
  const [conversionType, setConversionType] = useState('v2p');
  const [convertedVirtualBinary, setConvertedVirtualBinary] = useState('');
  const [convertedPhysicalBinary, setConvertedPhysicalBinary] = useState('');
  const [convertedAddressHex, setConvertedAddressHex] = useState('');

  const handleAddressConversion = () => {
  const address = parseInt(addressHex, 16);
  if (isNaN(address)) {
    toast.error("Invalid hex address");
    return;
  }

  const maxAddress = virtualSpace * 1024;
  if (address < 0 || address >= maxAddress) {
    toast.error("Address out of bounds. Must be within virtual address space.");
    return;
  }

  const offsetBits = Math.log2(pageSize * 1024);
  const virtualBits = Math.floor(Math.log2((virtualSpace * 1024) / (pageSize * 1024)) + offsetBits);
  const physicalBits = Math.floor(Math.log2((physicalSpace * 1024) / (pageSize * 1024)) + offsetBits);

    if (conversionType === 'v2p') {
      const virtualPage = address >> offsetBits;
      const offset = address & ((1 << offsetBits) - 1);
      const entry = pageTable[virtualPage];
      if (!entry || !entry.present) {
        const totalFrames = physicalSpace / pageSize;
        const { updatedTable, newPhysicalIndex } = handlePageReplacement([...pageTable], virtualPage, fifoQueue, totalFrames);
        setPageTable(updatedTable);
        setHighlightedIndex(virtualPage);

        const physicalPage = parseInt(newPhysicalIndex, 2);
        const physicalAddress = (physicalPage << offsetBits) | offset;
        setConvertedVirtualBinary(toBinary(address, virtualBits));
        setConvertedPhysicalBinary(toBinary(physicalAddress, physicalBits));

        const totalPhysicalBits = Math.floor(Math.log2(physicalSpace * 1024));
        setConvertedAddressHex("0x" + physicalAddress.toString(2)
          .padStart(totalPhysicalBits, '0')
          .match(/.{1,4}/g)
          .map(bin => parseInt(bin, 2).toString(16).toUpperCase())
          .join('')
        );
        return;
      }
      const physicalPage = parseInt(entry.physicalIndex, 2);
      const physicalAddress = (physicalPage << offsetBits) | offset;
      setHighlightedIndex(virtualPage);
      setConvertedVirtualBinary(toBinary(address, virtualBits));
      setConvertedPhysicalBinary(toBinary(physicalAddress, physicalBits));
      setConvertedAddressHex("0x" + physicalAddress.toString(16).toUpperCase());
    } else {
      const physicalPage = address >> offsetBits;
      const offset = address & ((1 << offsetBits) - 1);
      const virtualEntry = pageTable.find(e => e.present && parseInt(e.physicalIndex, 2) === physicalPage);
      if (!virtualEntry) {
        toast.error("Invalid physical address");
        return;
      }
      const virtualPage = parseInt(virtualEntry.virtualIndex, 2);
      const virtualAddress = (virtualPage << offsetBits) | offset;
      setHighlightedIndex(virtualPage);
      setConvertedPhysicalBinary(toBinary(address, physicalBits));
      setConvertedVirtualBinary(toBinary(virtualAddress, virtualBits));
      setConvertedAddressHex("0x" + virtualAddress.toString(16).toUpperCase());
    }
  };

  return (
    <div className={styles.page}>
      <h1>Virtual Addressing Tool</h1>

      <div className={styles.group}>
        <label>Virtual Space (in KB)</label>
        <input type="number" min="1" value={virtualSpace} onChange={e => setVirtualSpace(Number(e.target.value))} />
      </div>
      <div className={styles.group}>
        <label>Physical Space (in KB)</label>
        <input type="number" min="1" value={physicalSpace} onChange={e => setPhysicalSpace(Number(e.target.value))} />
      </div>
      <div className={styles.group}>
        <label>Page Size (in KB)</label>
        <input type="number" min="1" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} />
      </div>
      <br/>
      <button className={styles.button} onClick={generatePageTable}>Generate Page Table</button>

      <h2>Page Table</h2>
      {virtualSpace > 0 && pageSize > 0 && (
        <div style={{ marginTop: '1rem', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
          <strong>Address Structure:</strong>{' '}
          Index bits: {Math.log2((virtualSpace * 1024) / (pageSize * 1024))} | Offset bits: {Math.log2(pageSize * 1024)}
        </div>
      )}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ display: 'block', width: 'fit-content', minWidth: 'min-content' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Virtual Index</th>
              <th>Physical Index</th>
              <th>Present</th>
              <th>Arrival Order</th>
            </tr>
          </thead>
          <tbody>
            {pageTable.map((entry, i) => (
              <tr key={i} style={highlightedIndex === i ? { backgroundColor: '#e1f5fe' } : {}}>
                <td>{i + 1}</td>
                <td>
                  <div style={{ fontFamily: 'monospace', textAlign: 'center' }}>
                    {entry.virtualIndex}
                  </div>
                </td>
                <td
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  style={{ cursor: 'grab', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'center' }}
                >
                  <div style={{ fontFamily: 'monospace' }}>
                    {entry.physicalIndex || '-'}
                  </div>
                </td>
                <td>
                  <input type="checkbox" checked={entry.present} onChange={e => handleChange(i, 'present', e)} />
                </td>
                <td>
                  <input type="number" value={entry.arrivalOrder} onChange={e => handleChange(i, 'arrivalOrder', e)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <br/>
      <br/>
      <h3>Address Conversion</h3>
      <div className={styles.group}>
        <label>Enter Address (Hex):</label>
        <input
          type="text"
          value={addressHex}
          onChange={(e) => setAddressHex(e.target.value)}
          placeholder="e.g. 0x000A"
        />
      </div>
      <div className={styles.group}>
        <label>Conversion Direction:</label>
        <select value={conversionType} onChange={(e) => setConversionType(e.target.value)}>
          <option value="v2p">Virtual → Physical</option>
          <option value="p2v">Physical → Virtual</option>
        </select>
      </div>
      <div className={styles.group}>
        <button className={styles.button} onClick={handleAddressConversion}>Convert</button>
      </div>
      <div className={styles.group}>
        <label>Virtual Address (Binary):</label>
        <div style={{ fontFamily: 'monospace', padding: '4px', border: '1px solid #ccc' }}>
          {convertedVirtualBinary && highlightBinary(
            convertedVirtualBinary,
            Math.log2((virtualSpace * 1024) / (pageSize * 1024)),
            Math.log2(pageSize * 1024)
          )}
        </div>
      </div>
      <div className={styles.group}>
        <label>Physical Address (Binary):</label>
        <div style={{ fontFamily: 'monospace', padding: '4px', border: '1px solid #ccc' }}>
          {convertedPhysicalBinary && highlightBinary(
            convertedPhysicalBinary,
            Math.log2((physicalSpace * 1024) / (pageSize * 1024)),
            Math.log2(pageSize * 1024)
          )}
        </div>
      </div>
      <div className={styles.group}>
        <label>Converted Address (Hex):</label>
        <input type="text" value={convertedAddressHex} readOnly />
      </div>
    </div>
  );
}
