/* The films on the shelf, in order. Shared by film.html and tools/film-labels.html.
   Adding a film: add an entry here, put a still in images/FILM/, then open tools/film-labels.html
   and save its two printed labels into images/FILM/labels/. */
window.FILM_TAPES = [
  { id: 'specimen', title: 'Specimen', sub: '', year: '2026', run: '00:25', src: 'videos/film/specimen.mp4', ratio: 4 / 3, still: 'images/FILM/label-specimen.jpg', accent: '#6f9c83' },
  { id: 'fitcheck', title: 'Fitcheck', sub: '', year: '2026', run: '00:30', src: 'videos/film/fitcheck.mp4', ratio: 16 / 9, still: 'images/FILM/label-fitcheck.jpg', accent: '#d9779f' },
  { id: 'la-rain', title: 'Artificial Atmosphere', sub: 'LA RAIN', year: '2025', run: '02:53', vimeo: '1149379087', ratio: 16 / 9, still: 'images/FILM/label-la-rain.jpg', accent: '#5f86b8' },
  { id: 'fog', title: 'Artificial Atmosphere', sub: 'FOG', year: '2026', run: '01:30', vimeo: '1182815311', ratio: 16 / 9, still: 'images/FILM/label-fog.jpg', accent: '#8d9d7a' }
];
