import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Download, Camera, Upload, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import jsQR from 'jsqr';
import { cn } from '../lib/utils';
import { User } from '../lib/types';
import { supabase } from '../lib/supabase';

interface QRModalProps {
  currentUser: User;
  contacts: { code: string }[];
  onClose: () => void;
  onContactAdded: () => void;
  initialTab?: 'mine' | 'scan';
}

export function QRModal({ currentUser, contacts, onClose, onContactAdded, initialTab = 'mine' }: QRModalProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'scan'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Camera & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Copy code implementation
  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentUser.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download QR Code as SVG
  const handleDownloadQR = () => {
    const svgElement = document.getElementById('codechat-qr-svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `codechat-qr-${currentUser.code}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  // Toggle/Stop Scanning
  const stopCamera = () => {
    scanningRef.current = false;
    setScanning(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle Tab Change
  const handleTabChange = (tab: 'mine' | 'scan') => {
    setActiveTab(tab);
    setScanError(null);
    setSubmitError(null);
    setAddingCode(null);
    if (tab !== 'scan') {
      stopCamera();
    }
  };

  // Start Camera QR Scanning
  const startCamera = async () => {
    setScanError(null);
    setCameraBlocked(false);
    setAddingCode(null);

    let stream: MediaStream | null = null;
    try {
      try {
         stream = await navigator.mediaDevices.getUserMedia({
           video: { facingMode: 'environment' }
         });
      } catch (e: any) {
         // Fallback if environment camera constraint fails
         stream = await navigator.mediaDevices.getUserMedia({
           video: true
         });
      }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
        setScanning(true);
        scanningRef.current = true;
        // The first frame request
        requestRef.current = requestAnimationFrame(() => scanFrame(true));
      }
    } catch (err: any) {
      console.warn('Camera permissions issue or no device:', err);
      setCameraBlocked(true);
      setScanError(
        'Could not access the camera (Permission denied). To fix this, try opening the application in a new tab, or use the file upload option to select an image.'
      );
    }
  };

  // Scan frame by frame
  const scanFrame = (isFirstFrame = false) => {
    if (!scanningRef.current) return;
    
    if (!videoRef.current || !canvasRef.current) {
      if (scanningRef.current) {
         requestRef.current = requestAnimationFrame(() => scanFrame());
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        const decoded = code.data.trim().toUpperCase();
        if (decoded.length === 6) {
          stopCamera();
          handleFoundCode(decoded);
          return; // Stop scanning once we find it
        }
      }
    }
    
    if (scanningRef.current) {
       requestRef.current = requestAnimationFrame(() => scanFrame());
    }
  };

  // Handle Decoded QR code (from camera or file uploads)
  const handleFoundCode = (code: string) => {
    setScanError(null);
    setSubmitError(null);
    setAddingCode(code);
  };

  // Submitting connections
  const handleConnectWithCode = async (codeToConnect: string) => {
    if (isSubmitting) return;

    const cleanCode = codeToConnect.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setSubmitError('Invalid code formatting.');
      return;
    }

    if (cleanCode === currentUser.code) {
      setSubmitError('You cannot add your own code.');
      return;
    }

    if (contacts.some((c) => c.code === cleanCode)) {
      setSubmitError('This user is already in your chat list!');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: otherUser } = await supabase.from('users').select('*').eq('code', cleanCode).single();

      if (!otherUser) {
        setSubmitError('No registered user found with that code.');
      } else {
        // Add to our contacts list
        const { data: existingContact } = await supabase.from('contacts').select('*')
          .eq('user_code', currentUser.code).eq('contact_code', cleanCode).single();
          
        if (existingContact) {
           await supabase.from('contacts').update({
             display_name: otherUser.display_name || '',
             avatar_url: otherUser.avatar_url || '',
             is_deleted: false,
             last_message_at: new Date().toISOString()
           }).eq('id', existingContact.id);
        } else {
           await supabase.from('contacts').insert([{
             user_code: currentUser.code,
             contact_code: cleanCode,
             display_name: otherUser.display_name || '',
             avatar_url: otherUser.avatar_url || ''
           }]);
        }

        onContactAdded();
        onClose();
      }
    } catch (err) {
      console.error(err);
      setSubmitError('Failed to establish contact connection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Image Upload QR Decoding (highly reliable replacement/fallback)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          const decoded = code.data.trim().toUpperCase();
          if (decoded.length === 6) {
            handleFoundCode(decoded);
          } else {
            setScanError('QR code found, but it does not represent a valid 6-character CodeChat user code.');
          }
        } else {
          setScanError('No clear QR code pattern detected in the uploaded image. Please try again with a cleaner view.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-100 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">CodeChat Share</h2>
          </div>
          <button 
            onClick={() => {
              stopCamera();
              onClose();
            }} 
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-slate-100/80 rounded-xl mx-5 mt-4 border border-slate-200/40 flex-shrink-0">
          <button
            onClick={() => handleTabChange('mine')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
              activeTab === 'mine' 
                ? "bg-white text-violet-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            My QR Code
          </button>
          <button
            onClick={() => handleTabChange('scan')}
            className={cn(
              "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
              activeTab === 'scan' 
                ? "bg-white text-violet-700 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Scan QR Code
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          
          {activeTab === 'mine' ? (
            /* Tab: My QR Code */
            <div className="flex flex-col items-center text-center justify-center flex-1 py-4">
              <div className="p-4 bg-violet-50 rounded-3xl mb-6 shadow-inner border border-violet-100/50">
                <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 relative">
                  <QRCodeSVG
                    id="codechat-qr-svg"
                    value={currentUser.code}
                    size={200}
                    level="H"
                    includeMargin={true}
                    fgColor="#5b21b6" /* Beautiful violet level */
                    className="mx-auto"
                  />
                  {/* Subtle decorative identifier inside QR code frame */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-violet-600 border-2 border-white flex items-center justify-center shadow-lg">
                    <span className="text-white font-black text-sm">#</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-xs uppercase tracking-widest font-extrabold text-slate-400 block mb-2">
                  Your Connection Identity
                </span>
                <span className="text-3xl font-black text-violet-700 tracking-widest block font-sans">
                  {currentUser.code.slice(0, 3)}-{currentUser.code.slice(3)}
                </span>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                  Let others scan this code, or copy/save it as a vector graphic.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-xs mt-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-slate-100 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl shadow-sm transition-all text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadQR}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-violet-600/10 transition-all text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Save SVG</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab: Scan QR Code */
            <div className="flex flex-col flex-1">
              {addingCode ? (
                /* Found Connection Layout */
                <div className="flex flex-col items-center justify-center text-center p-4 bg-violet-50/50 rounded-3xl border border-violet-100/50 mb-4 my-auto">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Code Detected!</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    Would you like to connect with user code:
                  </p>
                  
                  <span className="text-2xl font-black text-violet-700 tracking-widest bg-white py-3 px-6 rounded-2xl border border-slate-150 shadow-sm mb-6 inline-block">
                    {addingCode.slice(0, 3)}-{addingCode.slice(3)}
                  </span>

                  {submitError && (
                    <div className="flex gap-2 items-start py-3 px-4 bg-red-50 text-red-600 rounded-xl mb-4 text-sm text-left max-w-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>{submitError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setAddingCode(null)}
                      className="flex-1 py-3 bg-white text-slate-600 font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm"
                    >
                      Rescan
                    </button>
                    <button
                      onClick={() => handleConnectWithCode(addingCode)}
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-55 text-sm flex items-center justify-center gap-1"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <span>Add contact</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Interactive scan controls */
                <div className="flex-1 flex flex-col justify-center">
                  
                  {scanning ? (
                    /* Live camera scanning dashboard */
                    <div className="relative w-full max-w-sm mx-auto aspect-square bg-slate-950 rounded-3xl overflow-hidden shadow-inner border-2 border-violet-300">
                      <video 
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                      <canvas 
                        ref={canvasRef} 
                        className="hidden" 
                      />
                      
                      {/* Scanning visual overlay */}
                      <div className="absolute inset-x-8 inset-y-8 border-2 border-dashed border-violet-400 rounded-2xl pointer-events-none flex flex-col justify-between p-4 animate-pulse">
                        <div className="flex justify-between">
                          <div className="w-4 h-4 border-l-2 border-t-2 border-violet-400"></div>
                          <div className="w-4 h-4 border-r-2 border-t-2 border-violet-400"></div>
                        </div>
                        <div className="flex justify-between">
                          <div className="w-4 h-4 border-l-2 border-b-2 border-violet-400"></div>
                          <div className="w-4 h-4 border-r-2 border-b-2 border-violet-400"></div>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-4 text-center">
                        <span className="bg-slate-900/80 text-white text-xs px-3 py-1 rounded-full font-medium backdrop-blur-sm shadow-md">
                          Position QR code in center
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Inactive Scan Controls Selector */
                    <div className="flex flex-col items-center gap-4 py-6 w-full max-w-sm mx-auto">
                      
                      {/* Camera Button Trigger */}
                      <button
                        onClick={startCamera}
                        className="w-full flex items-center gap-4 bg-violet-50 text-violet-700 p-4 rounded-2xl hover:bg-violet-100/70 border border-violet-200 transition-all text-left"
                      >
                        <div className="w-12 h-12 bg-violet-600 text-white rounded-xl flex items-center justify-center flex-shrink-0">
                          <Camera className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 mb-0.5">Use Live Camera</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Scan a CodeChat user code on another screen.
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 w-full my-1">
                        <div className="flex-1 h-px bg-slate-100"></div>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">or</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                      </div>

                      {/* File upload option (Super bulletproof) */}
                      <label className="w-full flex items-center gap-4 bg-white border-2 border-dashed border-slate-200 p-4 rounded-2xl hover:bg-slate-50 transition-all text-left cursor-pointer group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-100 group-hover:bg-violet-50 group-hover:text-violet-700 transition-colors">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 mb-0.5 group-hover:text-violet-600 transition-colors">Upload Saved QR Code</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Select a saved screenshot or captured photo of a QR scan.
                          </p>
                        </div>
                      </label>

                    </div>
                  )}

                  {/* Errors / Fallback Hints */}
                  {scanError && (
                    <div className="mt-4 flex gap-2.5 items-start py-3.5 px-4 bg-amber-50 text-amber-800 rounded-2xl text-xs max-w-sm mx-auto border border-amber-200/50">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div className="leading-relaxed">
                        <p className="font-bold">{cameraBlocked ? 'Camera Blocked/Unavailable' : 'Scan Issue'}</p>
                        <p>{scanError}</p>
                      </div>
                    </div>
                  )}

                  {scanning && (
                    <button
                      onClick={stopCamera}
                      className="mt-6 mx-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 px-4 rounded-lg transition-colors border border-slate-200"
                    >
                      Cancel Scanning
                    </button>
                  )}

                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
