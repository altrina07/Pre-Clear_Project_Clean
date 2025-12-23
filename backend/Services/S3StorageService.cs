using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace PreClear.Api.Services
{
    public class S3StorageService : IS3StorageService
    {
        private readonly IAmazonS3 _s3Client;
        private readonly AwsS3Settings _s3Settings;
        private readonly ILogger<S3StorageService> _logger;

        public S3StorageService(IAmazonS3 s3Client, IOptions<AwsS3Settings> s3SettingsOptions, ILogger<S3StorageService> logger)
        {
            _s3Client = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
            _s3Settings = s3SettingsOptions.Value ?? throw new ArgumentNullException(nameof(s3SettingsOptions));
            _logger = logger;
        }

        public async Task<string> UploadFileAsync(IFormFile file, string folder)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("File cannot be null or empty", nameof(file));

            try
            {
                var fileName = Path.GetFileNameWithoutExtension(file.FileName);
                var fileExtension = Path.GetExtension(file.FileName);
                var uniqueFileName = $"{fileName}_{Guid.NewGuid()}{fileExtension}";
                var key = string.IsNullOrEmpty(folder) ? uniqueFileName : $"{folder}/{uniqueFileName}";

                using (var stream = file.OpenReadStream())
                {
                    var putRequest = new PutObjectRequest
                    {
                        BucketName = _s3Settings.BucketName,
                        Key = key,
                        InputStream = stream,
                        ContentType = file.ContentType,
                        ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
                    };

                    var response = await _s3Client.PutObjectAsync(putRequest);

                    _logger.LogInformation($"File uploaded successfully: {key}");
                    return key;
                }
            }
            catch (AmazonS3Exception ex)
            {
                _logger.LogError($"S3 error uploading file: {ex.Message}");
                throw new InvalidOperationException($"Error uploading file to S3: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error uploading file: {ex.Message}");
                throw;
            }
        }

        public async Task<string> UploadStreamAsync(Stream content, string fileName, string contentType, string folder)
        {
            if (content == null || content.Length == 0)
                throw new ArgumentException("Stream cannot be null or empty", nameof(content));

            try
            {
                if (content.CanSeek)
                {
                    content.Position = 0;
                }

                var baseName = Path.GetFileNameWithoutExtension(fileName);
                var ext = Path.GetExtension(fileName);
                var safeBase = string.IsNullOrWhiteSpace(baseName) ? "file" : baseName;
                var uniqueFileName = $"{safeBase}_{Guid.NewGuid()}{ext}";
                var key = string.IsNullOrEmpty(folder) ? uniqueFileName : $"{folder}/{uniqueFileName}";

                var putRequest = new PutObjectRequest
                {
                    BucketName = _s3Settings.BucketName,
                    Key = key,
                    InputStream = content,
                    ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                    ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
                };

                await _s3Client.PutObjectAsync(putRequest);
                _logger.LogInformation($"Stream uploaded successfully: {key}");
                return key;
            }
            catch (AmazonS3Exception ex)
            {
                _logger.LogError($"S3 error uploading stream: {ex.Message}");
                throw new InvalidOperationException($"Error uploading stream to S3: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error uploading stream: {ex.Message}");
                throw;
            }
        }

        public async Task<Stream> DownloadFileAsync(string key)
        {
            if (string.IsNullOrEmpty(key))
                throw new ArgumentException("Key cannot be null or empty", nameof(key));

            try
            {
                var getRequest = new GetObjectRequest
                {
                    BucketName = _s3Settings.BucketName,
                    Key = key
                };

                var response = await _s3Client.GetObjectAsync(getRequest);
                var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                _logger.LogInformation($"File downloaded successfully: {key}");
                return memoryStream;
            }
            catch (AmazonS3Exception ex)
            {
                _logger.LogError($"S3 error downloading file: {ex.Message}");
                throw new InvalidOperationException($"Error downloading file from S3: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error downloading file: {ex.Message}");
                throw;
            }
        }

        public async Task DeleteFileAsync(string key)
        {
            if (string.IsNullOrEmpty(key))
                throw new ArgumentException("Key cannot be null or empty", nameof(key));

            try
            {
                var deleteRequest = new DeleteObjectRequest
                {
                    BucketName = _s3Settings.BucketName,
                    Key = key
                };

                await _s3Client.DeleteObjectAsync(deleteRequest);
                _logger.LogInformation($"File deleted successfully: {key}");
            }
            catch (AmazonS3Exception ex)
            {
                _logger.LogError($"S3 error deleting file: {ex.Message}");
                throw new InvalidOperationException($"Error deleting file from S3: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting file: {ex.Message}");
                throw;
            }
        }

        public async Task<int> DeleteAllFilesForShipmentAsync(long shipmentId)
        {
            if (shipmentId <= 0) throw new ArgumentException("Invalid shipmentId", nameof(shipmentId));

            var deleted = 0;
            try
            {
                string? continuationToken = null;
                do
                {
                    var listRequest = new ListObjectsV2Request
                    {
                        BucketName = _s3Settings.BucketName,
                        // We can't know shipperId; list under top-level and filter
                        Prefix = "shippers/",
                        ContinuationToken = continuationToken
                    };
                    var listResponse = await _s3Client.ListObjectsV2Async(listRequest);

                    var toDelete = listResponse.S3Objects
                        .Where(o => o.Key.Contains($"/shipments/{shipmentId}/"))
                        .Select(o => o.Key)
                        .ToList();

                    foreach (var key in toDelete)
                    {
                        try
                        {
                            await _s3Client.DeleteObjectAsync(new DeleteObjectRequest
                            {
                                BucketName = _s3Settings.BucketName,
                                Key = key
                            });
                            deleted++;
                            _logger.LogInformation("Deleted S3 object by scan: {Key}", key);
                        }
                        catch (AmazonS3Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed deleting S3 object during scan: {Key}", key);
                        }
                    }

                    continuationToken = (listResponse.IsTruncated == true) ? listResponse.NextContinuationToken : null;
                } while (!string.IsNullOrEmpty(continuationToken));

                _logger.LogInformation("Deleted {Count} S3 objects for shipment {ShipmentId} via scan", deleted, shipmentId);
                return deleted;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scanning/deleting S3 objects for shipment {ShipmentId}", shipmentId);
                throw;
            }
        }
    }
}
