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
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_APP_URL"
)

Write-Host "Setting up Vercel environment variables..."

# Add environment variables to Vercel
foreach ($name in $requiredVars) {
    if ($envVars.ContainsKey($name)) {
        $value = $envVars[$name]
        $tempFile = New-TemporaryFile
        Set-Content -Path $tempFile -Value $value
        Write-Host "Adding $name..."
        try {
            # This will still be interactive, but at least we're automating part of it
            vercel env add $name < $tempFile
        }
        catch {
            Write-Host "Error adding $name: $_"
        }
        finally {
            Remove-Item -Path $tempFile -Force
        }
    }
    else {
        Write-Host "Warning: $name not found in .env.local"
    }
}

Write-Host "Environment variables setup complete!" 