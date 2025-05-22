const animals = ['Raposa', 'Tigre', 'Lobo', 'Coruja', 'Pantera'];
function getRandomName() {
  return animals[Math.floor(Math.random() * animals.length)];
}
module.exports = { getRandomName };
