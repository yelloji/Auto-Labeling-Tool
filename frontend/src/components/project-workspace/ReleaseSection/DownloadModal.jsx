import React, { useState, useEffect } from 'react';
import './DownloadModal.css';
import { API_BASE_URL } from '../../../config';
import { logInfo, logError, logUserClick } from '../../../utils/professional_logger';

const DownloadModal = ({ 
  isOpen, 
  onClose, 
  release, 
  isExporting = false, 
  exportProgress = null 
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [packageInfo, setPackageInfo] = useState(null);

  // Add debugging logs
  console.log('DownloadModal props:', { isOpen, release, isExporting, exportProgress });

  useEffect(() => {
    logInfo('app.frontend.ui', 'download_modal_initialized', 'DownloadModal component initialized', {
      timestamp: new Date().toISOString(),
      component: 'DownloadModal',
      isOpen: isOpen,
      isExporting: isExporting,
      releaseId: release?.id,
      releaseName: release?.name
    });

    if (!release) {
      logError('app.frontend.validation', 'download_modal_no_release', 'DownloadModal initialized without release object', {
        timestamp: new Date().toISOString(),
        function: 'useEffect'
      });
      return;
    }

    if (!release.id) {
      logError('app.frontend.validation', 'download_modal_no_release_id', 'DownloadModal initialized without release ID', {
        timestamp: new Date().toISOString(),
        release: release,
        function: 'useEffect'
      });
      return;
    }

    if (release) {
      logInfo('app.frontend.ui', 'download_url_setup_started', 'Setting up download URL', {
        timestamp: new Date().toISOString(),
        releaseId: release.id,
        releaseName: release.name,
        modelPath: release.model_path,
        function: 'useEffect'
      });

      if (release.model_path && release.model_path.startsWith('/api/')) {
        // If model_path is a relative API path, use API_BASE_URL
        const url = `${API_BASE_URL}${release.model_path}`;
        console.log('Setting download URL from model_path (relative):', url);
        setDownloadUrl(url);
        logInfo('app.frontend.ui', 'download_url_set_relative', 'Download URL set from relative model path', {
          timestamp: new Date().toISOString(),
          originalPath: release.model_path,
          finalUrl: url,
          function: 'useEffect'
        });
      } else if (release.model_path && (release.model_path.startsWith('http://') || release.model_path.startsWith('https://'))) {
        // If model_path is an absolute URL, use it directly
        console.log('Setting download URL from model_path (absolute):', release.model_path);
        setDownloadUrl(release.model_path);
        logInfo('app.frontend.ui', 'download_url_set_absolute', 'Download URL set from absolute model path', {
          timestamp: new Date().toISOString(),
          modelPath: release.model_path,
          function: 'useEffect'
        });
      } else if (release.id) {
        // Fallback to constructing URL from release ID
        const url = `${API_BASE_URL}/api/v1/releases/${release.id}/download`;
        console.log('Setting download URL from release ID:', url);
        setDownloadUrl(url);
        logInfo('app.frontend.ui', 'download_url_set_fallback', 'Download URL set from release ID fallback', {
          timestamp: new Date().toISOString(),
          releaseId: release.id,
          finalUrl: url,
          function: 'useEffect'
        });
      }
    }
  }, [release]);

  // After export completes, fetch package-info to show accurate counts
  useEffect(() => {
    const fetchPackageInfo = async () => {
      logInfo('app.frontend.interactions', 'fetch_package_info_started', 'Fetching package information', {
        timestamp: new Date().toISOString(),
        isExporting: isExporting,
        releaseId: release?.id,
        function: 'fetchPackageInfo'
      });

      try {
        if (!isExporting && release?.id) {
          const resp = await fetch(`${API_BASE_URL}/api/v1/releases/${release.id}/package-info`);
          if (resp.ok) {
            const data = await resp.json();
            setPackageInfo(data);
            logInfo('app.frontend.interactions', 'fetch_package_info_success', 'Package information fetched successfully', {
              timestamp: new Date().toISOString(),
              releaseId: release.id,
              packageInfo: data,
              function: 'fetchPackageInfo'
            });
          } else {
            logError('app.frontend.interactions', 'fetch_package_info_failed', 'Failed to fetch package information', {
              timestamp: new Date().toISOString(),
              releaseId: release.id,
              status: resp.status,
              statusText: resp.statusText,
              function: 'fetchPackageInfo'
            });
          }
        }
      } catch (e) {
        logError('app.frontend.interactions', 'fetch_package_info_error', 'Error fetching package information', {
          timestamp: new Date().toISOString(),
          releaseId: release?.id,
          error: e.message,
          function: 'fetchPackageInfo'
        });
        // Non-blocking
      }
    };
    fetchPackageInfo();
  }, [isExporting, release]);

  const copyToClipboard = async (text) => {
    if (!text) {
      logError('app.frontend.validation', 'copy_to_clipboard_no_text', 'Copy to clipboard failed - no text provided', {
        timestamp: new Date().toISOString(),
        function: 'copyToClipboard'
      });
      return;
    }

    logInfo('app.frontend.interactions', 'copy_to_clipboard_started', 'Copy to clipboard started', {
      timestamp: new Date().toISOString(),
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 50) + (text?.length > 50 ? '...' : ''),
      function: 'copyToClipboard'
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logInfo('app.frontend.interactions', 'copy_to_clipboard_success', 'Text copied to clipboard successfully', {
        timestamp: new Date().toISOString(),
        textLength: text?.length || 0,
        function: 'copyToClipboard'
      });
    } catch (err) {
      logError('app.frontend.interactions', 'copy_to_clipboard_failed', 'Failed to copy to clipboard', {
        timestamp: new Date().toISOString(),
        error: err.message,
        function: 'copyToClipboard'
      });
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDirectDownload = () => {
    logUserClick('direct_download_button_clicked', 'User clicked direct download button');
    logInfo('app.frontend.interactions', 'direct_download_started', 'Direct download started', {
      timestamp: new Date().toISOString(),
      downloadUrl: downloadUrl,
      releaseName: release?.name,
      function: 'handleDirectDownload'
    });

    if (downloadUrl) {
      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${release.name}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      logInfo('app.frontend.interactions', 'direct_download_triggered', 'Direct download triggered', {
        timestamp: new Date().toISOString(),
        downloadUrl: downloadUrl,
        fileName: `${release.name}.zip`,
        function: 'handleDirectDownload'
      });
    } else {
      logError('app.frontend.validation', 'direct_download_no_url', 'Direct download failed - no download URL available', {
        timestamp: new Date().toISOString(),
        releaseName: release?.name,
        releaseId: release?.id,
        function: 'handleDirectDownload'
      });
    }
  };

  const getCurlCommand = () => {
    const command = `curl -O "${downloadUrl}"`;
    logInfo('app.frontend.ui', 'curl_command_generated', 'cURL command generated', {
      timestamp: new Date().toISOString(),
      command: command,
      function: 'getCurlCommand'
    });
    return command;
  };

  const getWgetCommand = () => {
    const command = `wget "${downloadUrl}"`;
    logInfo('app.frontend.ui', 'wget_command_generated', 'wget command generated', {
      timestamp: new Date().toISOString(),
      command: command,
      function: 'getWgetCommand'
    });
    return command;
  };

  // Check if the modal should be open
  console.log('DownloadModal isOpen check:', isOpen);
  if (!isOpen) {
    console.log('DownloadModal not open, returning null');
    return null;
  }

  // Log when main component is rendered
  logInfo('app.frontend.ui', 'download_modal_rendered', 'DownloadModal component rendered', {
    timestamp: new Date().toISOString(),
    component: 'DownloadModal',
    isOpen: isOpen,
    isExporting: isExporting,
    exportProgress: exportProgress,
    hasDownloadUrl: !!downloadUrl,
    hasPackageInfo: !!packageInfo,
    copied: copied
  });

  return (
    <div className="download-modal-overlay" onClick={() => {
      logUserClick('download_modal_overlay_clicked', 'User clicked download modal overlay');
      logInfo('app.frontend.ui', 'download_modal_closing', 'Download modal closing via overlay click', {
        timestamp: new Date().toISOString()
      });
      onClose();
    }}>
      <div className="download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="download-modal-header">
          <h2>
            {isExporting ? (
              <>
                <span className="export-icon">⚙️</span>
                Exporting Release
              </>
            ) : (
              <>
                <span className="download-icon">📦</span>
                Download Release
              </>
            )}
          </h2>
          <button className="close-button" onClick={() => {
            logUserClick('download_modal_close_button_clicked', 'User clicked download modal close button');
            logInfo('app.frontend.ui', 'download_modal_closing', 'Download modal closing via close button', {
              timestamp: new Date().toISOString()
            });
            onClose();
          }}>×</button>
        </div>

        <div className="download-modal-content">
          {isExporting ? (
            // Export Progress View
            <div className="export-progress-section">
              <div className="release-info">
                <h3>{release?.name || 'New Release'}</h3>
                <p className="release-description">
                  {release?.description || 'Generating release with transformations...'}
                </p>
              </div>

              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${exportProgress?.percentage || 0}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {exportProgress?.percentage || 0}% Complete
                </div>
              </div>

              <div className="progress-steps">
                <div className="step-item">
                  <span className="step-icon">
                    {exportProgress?.step === 'initializing' ? '🔄' : '✅'}
                  </span>
                  <span className="step-text">Initializing export process</span>
                </div>
                <div className="step-item">
                  <span className="step-icon">
                    {exportProgress?.step === 'processing_images' ? '🔄' : 
                     exportProgress?.step === 'creating_zip' || exportProgress?.step === 'completed' ? '✅' : '⏳'}
                  </span>
                  <span className="step-text">Processing images and transformations</span>
                </div>
                <div className="step-item">
                  <span className="step-icon">
                    {exportProgress?.step === 'creating_zip' ? '🔄' : 
                     exportProgress?.step === 'completed' ? '✅' : '⏳'}
                  </span>
                  <span className="step-text">Creating ZIP package</span>
                </div>
                <div className="step-item">
                  <span className="step-icon">
                    {exportProgress?.step === 'completed' ? '✅' : '⏳'}
                  </span>
                  <span className="step-text">Export completed</span>
                </div>
              </div>

              {exportProgress?.step === 'completed' && (
                <div className="export-complete-message">
                  <span className="success-icon">🎉</span>
                  <p>Release exported successfully! Choose your download method below.</p>
                </div>
              )}
            </div>
          ) : (
            // Download Options View
            <div className="download-options-section">
              <div className="release-info">
                <h3>{release?.name}</h3>
                <p className="release-description">{release?.description}</p>
                <div className="release-stats">
                  <span className="stat-item">
                    <span className="stat-icon">📊</span>
                    Format: {release?.export_format || 'YOLO'}
                  </span>
                  <span className="stat-item">
                    <span className="stat-icon">🖼️</span>
                    Images: {packageInfo?.file_counts?.images?.total ||
                             release?.final_image_count ||
                             ((release?.original_image_count || 0) + (release?.augmented_image_count || 0)) ||
                             ((release?.total_original_images || 0) + (release?.total_augmented_images || 0)) ||
                             'N/A'}
                  </span>
                  <span className="stat-item">
                    <span className="stat-icon">📅</span>
                    Created: {release?.created_at ? new Date(release.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="download-methods">
                <h4>Choose Download Method:</h4>
                
                {/* Direct Download Button */}
                <div className="download-method">
                  <div className="method-header">
                    <span className="method-icon">⬇️</span>
                    <span className="method-title">Direct Download</span>
                  </div>
                  <p className="method-description">
                    Download the ZIP file directly to your computer
                  </p>
                  <button 
                    className="download-button primary"
                    onClick={handleDirectDownload}
                    disabled={!downloadUrl}
                  >
                    <span className="button-icon">📦</span>
                    Download ZIP File
                  </button>
                </div>

                {/* Copy Link Method */}
                <div className="download-method">
                  <div className="method-header">
                    <span className="method-icon">🔗</span>
                    <span className="method-title">Copy Download Link</span>
                  </div>
                  <p className="method-description">
                    Copy the download URL to share or use in scripts
                  </p>
                  <div className="copy-section">
                    <input 
                      type="text" 
                      value={downloadUrl} 
                      readOnly 
                      className="copy-input"
                    />
                    <button 
                      className="copy-button"
                      onClick={() => {
                        logUserClick('copy_download_link_button_clicked', 'User clicked copy download link button');
                        copyToClipboard(downloadUrl);
                      }}
                    >
                      {copied ? '✅ Copied!' : '📋 Copy'}
                    </button>
                  </div>
                </div>

                {/* Terminal Commands */}
                <div className="download-method">
                  <div className="method-header">
                    <span className="method-icon">💻</span>
                    <span className="method-title">Terminal Commands</span>
                  </div>
                  <p className="method-description">
                    Use these commands to download from terminal
                  </p>
                  
                  <div className="command-section">
                    <label className="command-label">Using curl:</label>
                    <div className="command-container">
                      <code className="command-text">{getCurlCommand()}</code>
                      <button 
                        className="copy-button small"
                        onClick={() => {
                          logUserClick('copy_curl_command_button_clicked', 'User clicked copy curl command button');
                          copyToClipboard(getCurlCommand());
                        }}
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="command-section">
                    <label className="command-label">Using wget:</label>
                    <div className="command-container">
                      <code className="command-text">{getWgetCommand()}</code>
                      <button 
                        className="copy-button small"
                        onClick={() => {
                          logUserClick('copy_wget_command_button_clicked', 'User clicked copy wget command button');
                          copyToClipboard(getWgetCommand());
                        }}
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="download-modal-footer">
          {isExporting ? (
            <button className="cancel-button" onClick={() => {
              logUserClick('run_in_background_button_clicked', 'User clicked run in background button');
              logInfo('app.frontend.ui', 'export_background_mode', 'Export set to run in background', {
                timestamp: new Date().toISOString(),
                releaseName: release?.name
              });
              onClose();
            }}>
              Run in Background
            </button>
          ) : (
            <button className="close-button-footer" onClick={() => {
              logUserClick('download_modal_footer_close_button_clicked', 'User clicked download modal footer close button');
              logInfo('app.frontend.ui', 'download_modal_closing', 'Download modal closing via footer close button', {
                timestamp: new Date().toISOString()
              });
              onClose();
            }}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;