'use client'
import React, { useState } from 'react'
import QrScanner from 'react-qr-scanner'

interface BarcodeScannerProps {
  onScan: (data: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan }) => {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (data: any) => {
    if (data) {
      onScan(data.text);
    }
  }

  const handleError = (err: any) => {
    setError(err.message);
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-md h-full">
        <QrScanner
          delay={300}
          onError={handleError}
          onScan={handleScan}
          style={{ width: '100%', height: '100%'}}
          constraints={{
            video: { facingMode: { exact: `environment` } }
          }}
        />
      </div>
      {error && <p className="text-red-500 absolute bottom-10">{error}</p>}
    </div>
  )
}
