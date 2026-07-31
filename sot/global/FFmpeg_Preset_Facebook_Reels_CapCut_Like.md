# Preset FFmpeg untuk Facebook Reels (CapCut-like)

## Tujuan

Menghasilkan output yang mendekati kualitas export CapCut untuk Facebook
Reels (9:16).

## Output Options

``` bash
-map [v_out]
-map [a_out]

-c:v libx264
-preset slow
-crf 18
-profile:v high
-level 4.1
-pix_fmt yuv420p

-r 30
-g 60
-keyint_min 60
-sc_threshold 0

-movflags +faststart

-c:a aac
-b:a 192k
-ar 48000
-ac 2

-shortest
```

## Catatan Implementasi

Ganti bagian:

``` javascript
command.outputOptions([
  `-map ${mapVideo}`,
  `-map ${mapAudio}`,
  '-c:v libx264',
  '-pix_fmt yuv420p',
  '-c:a aac',
  '-shortest'
]);
```

menjadi:

``` javascript
command.outputOptions([
  `-map ${mapVideo}`,
  `-map ${mapAudio}`,

  '-c:v libx264',
  '-preset slow',
  '-crf 18',
  '-profile:v high',
  '-level 4.1',
  '-pix_fmt yuv420p',

  '-r 30',
  '-g 60',
  '-keyint_min 60',
  '-sc_threshold 0',

  '-movflags +faststart',

  '-c:a aac',
  '-b:a 192k',
  '-ar 48000',
  '-ac 2',

  '-shortest'
]);
```

## Opsional (Kualitas Maksimum)

Gunakan: - preset = slower - crf = 17

Hanya jika server masih memiliki kapasitas CPU yang cukup.

## Jangan Diubah

-   complexFilter
-   concat
-   amix
-   scale
-   crop
-   setsar

Pipeline tersebut sudah baik. Fokus optimasi hanya pada encoder output.
