import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Download, Upload, Camera, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Handle Tab Change
  const handleTabChange = (tab: 'mine' | 'scan') => {
    setActiveTab(tab);
    setScanError(null);
    setSubmitError(null);
    setAddingCode(null);
  };

  // Handle Decoded QR code (from file uploads or manual entry)
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Scale down large images to improve scanning speed and reliability
        const MAX_DIMENSION = 800;
        let scanWidth = img.width;
        let scanHeight = img.height;
        
        if (scanWidth > MAX_DIMENSION || scanHeight > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / scanWidth, MAX_DIMENSION / scanHeight);
          scanWidth = Math.floor(scanWidth * ratio);
          scanHeight = Math.floor(scanHeight * ratio);
        }

        canvas.width = scanWidth;
        canvas.height = scanHeight;
        ctx.drawImage(img, 0, 0, scanWidth, scanHeight);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

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
            onClick={onClose} 
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
                  
                  {/* Inactive Scan Controls Selector */}
                  <div className="flex flex-col items-center gap-4 py-6 w-full max-w-sm mx-auto">
                    
                    {/* Manual Code Entry */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const code = formData.get('manualCode') as string;
                        if (code && code.trim().length === 6) {
                          handleFoundCode(code.trim().toUpperCase());
                        } else {
                          setScanError('Code must be exactly 6 characters long.');
                        }
                      }}
                      className="w-full flex items-center gap-2"
                    >
                      <input 
                        name="manualCode"
                        type="text" 
                        placeholder="Enter 6-char code" 
                        maxLength={6}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 uppercase font-mono tracking-widest text-center"
                      />
                      <button 
                        type="submit"
                        className="bg-violet-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-violet-700 transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </form>

                    <div className="flex items-center gap-3 w-full my-4">
                      <div className="flex-1 h-px bg-slate-100"></div>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-slate-100"></div>
                    </div>

                    {/* Camera / Upload options */}
                    <div className="w-full flex flex-col gap-3 mt-2">
                      {/* Take Photo Option */}
                      <label className="w-full flex items-center gap-4 bg-white border-2 border-slate-200 p-4 rounded-2xl hover:bg-slate-50 transition-all text-left cursor-pointer group">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 border border-violet-100 group-hover:bg-violet-100 transition-colors">
                          <Camera className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 mb-0.5 group-hover:text-violet-600 transition-colors">Take a Photo</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Use your camera to snap a QR code
                          </p>
                        </div>
                      </label>

                      {/* File upload option */}
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
                          <h4 className="font-bold text-slate-900 mb-0.5 group-hover:text-violet-600 transition-colors">Upload Image</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Select a saved screenshot or photo
                          </p>
                        </div>
                      </label>
                    </div>

                  </div>

                  {/* Errors / Fallback Hints */}
                  {scanError && (
                    <div className="mt-4 flex gap-2.5 items-start py-3.5 px-4 bg-amber-50 text-amber-800 rounded-2xl text-xs max-w-sm mx-auto border border-amber-200/50">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div className="leading-relaxed">
                        <p className="font-bold">Scan Issue</p>
                        <p>{scanError}</p>
                      </div>
                    </div>
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
