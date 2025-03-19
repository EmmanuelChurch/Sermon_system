# Read the environment variables from .env.local
$envContent = Get-Content -Path ".env.local" -ErrorAction SilentlyContinue

# Parse the environment variables
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$name] = $value
    }
}

# Key environment variables needed for the build
$requiredVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_BASE_URL"
)

Write-Host "============================================="
Write-Host "Environment Variables for Vercel Dashboard"
Write-Host "============================================="
Write-Host "Copy and paste these values into your Vercel project environment variables:"
Write-Host ""

# Display environment variables
foreach ($name in $requiredVars) {
    if ($envVars.ContainsKey($name)) {
        $value = $envVars[$name]
        Write-Host "$name`:"
        Write-Host "$value"
        Write-Host ""
    }
    else {
        Write-Host "$name`: Not found in .env.local"
        Write-Host ""
    }
}

Write-Host "============================================="
Write-Host "Also add these additional variables:"
Write-Host "NEXT_PUBLIC_APP_URL: https://sermon-system.vercel.app"
Write-Host "USE_VERCEL_BLOB: true"
Write-Host "=============================================" 