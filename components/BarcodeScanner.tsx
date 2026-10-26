'use client'
import React, { useState } from 'react'
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner'

interface BarcodeScannerProps {
  onScan: (data: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan }) => {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
        const firstCode = detectedCodes[0];
        if (firstCode && firstCode.rawValue) {
            onScan(firstCode.rawValue);
        }
    }
  }

  const handleError = (err: unknown) => {
    if (err instanceof Error) {
        setError(err.message);
    } else {
        setError('An unknown scanning error occurred.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-md h-auto aspect-square bg-gray-800 rounded-lg overflow-hidden">
        <Scanner
          onScan={handleScan}
          onError={handleError}
          constraints={{
            facingMode: 'environment'
          }}
          classNames={{
            container: 'w-full h-full'
          }}
        />
      </div>
      {error && <p className="text-red-500 absolute bottom-10 bg-black/50 p-2 rounded">{error}</p>}
    </div>
  )
}
