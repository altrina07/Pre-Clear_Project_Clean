# Quick Deployment Script - Frontend to S3 + CloudFront
# PreClear React Application

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PreClear Frontend Deployment - S3 + CloudFront               ║" -ForegroundColor Cyan
Write-Host "║  Automated Deployment Script                                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Configuration
$FRONTEND_BUCKET = "pre-clear-frontend-ui"
$AWS_REGION = "us-east-1"
$FRONTEND_DIR = "C:\Pre-Clear_Project_Clean\frontend"

# Step 0: Verify prerequisites
Write-Host "Step 0: Verifying prerequisites..." -ForegroundColor Yellow

# Check AWS CLI
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✓ AWS CLI installed: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS CLI not found. Install from: https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

# Check AWS credentials
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Host "✓ AWS credentials configured" -ForegroundColor Green
    Write-Host "  User: $($identity.UserId)" -ForegroundColor Gray
    Write-Host "  Account: $($identity.Account)" -ForegroundColor Gray
} catch {
    Write-Host "✗ AWS credentials not configured. Run: aws configure" -ForegroundColor Red
    exit 1
}

# Check region
$currentRegion = aws configure get region
if ($currentRegion -ne $AWS_REGION) {
    Write-Host "⚠ Warning: AWS CLI region is $currentRegion, expected $AWS_REGION" -ForegroundColor Yellow
    Write-Host "  Continuing with $AWS_REGION..." -ForegroundColor Yellow
}

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Install from: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if frontend directory exists
if (-not (Test-Path $FRONTEND_DIR)) {
    Write-Host "✗ Frontend directory not found: $FRONTEND_DIR" -ForegroundColor Red
    exit 1
}

Write-Host "`n" -NoNewline

# Step 1: Check if S3 bucket exists
Write-Host "Step 1: Checking S3 bucket..." -ForegroundColor Yellow

try {
    aws s3api head-bucket --bucket $FRONTEND_BUCKET 2>&1 | Out-Null
    Write-Host "✓ S3 bucket exists: $FRONTEND_BUCKET" -ForegroundColor Green
} catch {
    Write-Host "✗ S3 bucket does not exist: $FRONTEND_BUCKET" -ForegroundColor Red
    Write-Host "`nTo create the bucket, run these commands:" -ForegroundColor Yellow
    Write-Host "  aws s3api create-bucket --bucket $FRONTEND_BUCKET --region $AWS_REGION" -ForegroundColor Gray
    Write-Host "  aws s3 website s3://$FRONTEND_BUCKET/ --index-document index.html --error-document index.html" -ForegroundColor Gray
    Write-Host "`nOr follow the full guide in FRONTEND_DEPLOYMENT_GUIDE.md" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n" -NoNewline

# Step 2: Clean previous build
Write-Host "Step 2: Cleaning previous build..." -ForegroundColor Yellow

Set-Location $FRONTEND_DIR

if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "✓ Removed old dist/ folder" -ForegroundColor Green
} else {
    Write-Host "✓ No previous build found" -ForegroundColor Green
}

if (Test-Path "node_modules\.vite") {
    Remove-Item -Path "node_modules\.vite" -Recurse -Force
    Write-Host "✓ Cleared Vite cache" -ForegroundColor Green
}

Write-Host "`n" -NoNewline

# Step 3: Install dependencies
Write-Host "Step 3: Installing dependencies..." -ForegroundColor Yellow

npm install --silent 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ npm install failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n" -NoNewline

# Step 4: Build for production
Write-Host "Step 4: Building for production..." -ForegroundColor Yellow

npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
    
    # Show build output size
    $distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  Build size: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n" -NoNewline

# Step 5: Verify build output
Write-Host "Step 5: Verifying build output..." -ForegroundColor Yellow

if (-not (Test-Path "dist\index.html")) {
    Write-Host "✗ dist\index.html not found" -ForegroundColor Red
    exit 1
}

$assetsPath = "dist\assets"
if (-not (Test-Path $assetsPath)) {
    Write-Host "✗ dist\assets folder not found" -ForegroundColor Red
    exit 1
}

$jsFiles = Get-ChildItem -Path $assetsPath -Filter "*.js" -File
$cssFiles = Get-ChildItem -Path $assetsPath -Filter "*.css" -File

Write-Host "✓ Build output verified" -ForegroundColor Green
Write-Host "  Files: index.html, $($jsFiles.Count) JS files, $($cssFiles.Count) CSS files" -ForegroundColor Gray

Write-Host "`n" -NoNewline

# Step 6: Upload to S3
Write-Host "Step 6: Uploading to S3..." -ForegroundColor Yellow

# Upload assets with long cache
Write-Host "  Uploading assets (with cache)..." -ForegroundColor Gray
aws s3 sync ./dist/ s3://$FRONTEND_BUCKET/ `
    --delete `
    --cache-control "public, max-age=31536000, immutable" `
    --exclude "index.html" `
    --exclude "*.txt" `
    --region $AWS_REGION `
    2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to upload assets" -ForegroundColor Red
    exit 1
}

# Upload index.html with no cache
Write-Host "  Uploading index.html (no cache)..." -ForegroundColor Gray
aws s3 cp ./dist/index.html s3://$FRONTEND_BUCKET/ `
    --cache-control "no-cache, no-store, must-revalidate" `
    --region $AWS_REGION `
    2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to upload index.html" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Upload complete" -ForegroundColor Green

Write-Host "`n" -NoNewline

# Step 7: Get S3 website URL
Write-Host "Step 7: Deployment URLs..." -ForegroundColor Yellow

$s3WebsiteUrl = "http://$FRONTEND_BUCKET.s3-website-$AWS_REGION.amazonaws.com"
Write-Host "  S3 Website: $s3WebsiteUrl" -ForegroundColor Cyan

# Try to get CloudFront distribution
try {
    $distributions = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$FRONTEND_BUCKET.s3-website-$AWS_REGION.amazonaws.com']].{Domain:DomainName,Status:Status}" --output json | ConvertFrom-Json
    
    if ($distributions) {
        foreach ($dist in $distributions) {
            Write-Host "  CloudFront: https://$($dist.Domain) (Status: $($dist.Status))" -ForegroundColor Cyan
            
            if ($dist.Status -eq "Deployed") {
                Write-Host "`n✓ Frontend deployed successfully!" -ForegroundColor Green
                Write-Host "`nAccess your application at:" -ForegroundColor White
                Write-Host "  https://$($dist.Domain)" -ForegroundColor Cyan
            } else {
                Write-Host "`n⚠ CloudFront distribution is deploying..." -ForegroundColor Yellow
                Write-Host "  Wait 5-10 minutes, then access: https://$($dist.Domain)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "`n⚠ No CloudFront distribution found" -ForegroundColor Yellow
        Write-Host "  Create one following FRONTEND_DEPLOYMENT_GUIDE.md Step 4" -ForegroundColor Gray
    }
} catch {
    Write-Host "`n⚠ Could not check CloudFront distributions" -ForegroundColor Yellow
}

Write-Host "`n" -NoNewline

# Step 8: Next steps
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Test S3 website: $s3WebsiteUrl" -ForegroundColor Gray
Write-Host "  2. Create CloudFront distribution (if not exists)" -ForegroundColor Gray
Write-Host "  3. Update backend CORS with CloudFront domain" -ForegroundColor Gray
Write-Host "  4. Invalidate CloudFront cache if needed:" -ForegroundColor Gray
Write-Host "     aws cloudfront create-invalidation --distribution-id E123 --paths '/*'" -ForegroundColor DarkGray
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Done
Write-Host "✓ Deployment script complete!" -ForegroundColor Green
