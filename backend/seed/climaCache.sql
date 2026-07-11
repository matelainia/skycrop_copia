-- SQL DDL schema for Climate caching by coordinates grid

CREATE TABLE IF NOT EXISTS public.clima_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coord_hash VARCHAR(64) UNIQUE NOT NULL, -- Format: "lat_lon" rounded to 3 decimal places
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  weather_data JSONB NOT NULL,            -- Unified V1 JSON response (current, forecast, alerts, metadata)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clima_cache_coords ON public.clima_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_clima_cache_expires ON public.clima_cache(expires_at);
