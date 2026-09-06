// Subject catalogue. Semesters 1 and 2 are common across branches, as they are
// in most Indian engineering programmes; branches diverge from semester 3.
// Codes follow the seven-digit convention used by state technical universities.

const COMMON = {
  1: [
    ['3110018', 'Mathematics I', 4], ['3110011', 'Physics', 4],
    ['3110013', 'Basic Electronics', 4], ['3110003', 'Programming for Problem Solving', 4],
    ['3110014', 'Engineering Graphics & Design', 3],
  ],
  2: [
    ['3110015', 'Mathematics II', 4], ['3110016', 'Chemistry', 4],
    ['3110005', 'Basic Electrical Engineering', 4], ['3110006', 'Engineering Mechanics', 4],
    ['3110002', 'English & Communication Skills', 3],
  ],
};

const BRANCH_SUBJECTS = {
  CE: {
    3: [['3130702', 'Data Structures', 4], ['3130703', 'Database Management Systems', 4], ['3130704', 'Digital Fundamentals', 4], ['3130006', 'Probability & Statistics', 4], ['3130008', 'Effective Technical Communication', 3]],
    4: [['3140707', 'Object Oriented Programming with Java', 4], ['3140708', 'Computer Organisation & Architecture', 4], ['3140705', 'Operating Systems', 4], ['3140709', 'Discrete Mathematics', 4], ['3140706', 'Design Engineering I', 2]],
    5: [['3150703', 'Analysis & Design of Algorithms', 4], ['3150710', 'Computer Networks', 4], ['3150712', 'Software Engineering', 4], ['3150714', 'Microprocessor & Interfacing', 4], ['3150716', 'Python for Data Science', 3]],
    6: [['3160707', 'Theory of Computation', 4], ['3160713', 'Artificial Intelligence', 4], ['3160714', 'Web Technology', 4], ['3160716', 'System Programming', 4], ['3160717', 'Mobile Application Development', 3]],
    7: [['3170716', 'Machine Learning', 4], ['3170718', 'Compiler Design', 4], ['3170722', 'Cloud Computing', 4], ['3170728', 'Information Security', 4], ['3171101', 'Project I', 4]],
    8: [['3180701', 'Big Data Analytics', 4], ['3180710', 'Distributed Systems', 4], ['3180702', 'Internet of Things', 4], ['3181101', 'Project II', 8]],
  },
  IT: {
    3: [['3130702', 'Data Structures', 4], ['3130703', 'Database Management Systems', 4], ['3130004', 'Digital Electronics', 4], ['3130006', 'Probability & Statistics', 4], ['3130008', 'Effective Technical Communication', 3]],
    4: [['3140707', 'Object Oriented Programming with Java', 4], ['3140705', 'Operating Systems', 4], ['3140704', 'Computer Networks Fundamentals', 4], ['3140709', 'Discrete Mathematics', 4], ['3140706', 'Design Engineering I', 2]],
    5: [['3150703', 'Analysis & Design of Algorithms', 4], ['3151601', 'Advanced Java Programming', 4], ['3150712', 'Software Engineering', 4], ['3151603', 'Data Visualization', 4], ['3150716', 'Python for Data Science', 3]],
    6: [['3161608', 'Data Mining & Warehousing', 4], ['3160713', 'Artificial Intelligence', 4], ['3160714', 'Web Technology', 4], ['3161610', 'Network Security', 4], ['3160717', 'Mobile Application Development', 3]],
    7: [['3170716', 'Machine Learning', 4], ['3171610', 'Cyber Security', 4], ['3170722', 'Cloud Computing', 4], ['3171614', 'Natural Language Processing', 4], ['3171101', 'Project I', 4]],
    8: [['3180701', 'Big Data Analytics', 4], ['3181607', 'Blockchain Technology', 4], ['3180702', 'Internet of Things', 4], ['3181101', 'Project II', 8]],
  },
  ME: {
    3: [['3131905', 'Thermodynamics', 4], ['3131906', 'Materials Science & Metallurgy', 4], ['3130006', 'Probability & Statistics', 4], ['3131901', 'Manufacturing Processes I', 4], ['3130008', 'Effective Technical Communication', 3]],
    4: [['3141907', 'Fluid Mechanics', 4], ['3141908', 'Kinematics of Machines', 4], ['3141905', 'Manufacturing Processes II', 4], ['3141906', 'Strength of Materials', 4], ['3140706', 'Design Engineering I', 2]],
    5: [['3151907', 'Heat Transfer', 4], ['3151909', 'Dynamics of Machinery', 4], ['3151911', 'Machine Design I', 4], ['3151913', 'Industrial Engineering', 4], ['3151916', 'Computer Aided Design', 3]],
    6: [['3161906', 'Internal Combustion Engines', 4], ['3161910', 'Machine Design II', 4], ['3161912', 'Refrigeration & Air Conditioning', 4], ['3161915', 'Control Engineering', 4], ['3161917', 'Finite Element Methods', 3]],
    7: [['3171912', 'Power Plant Engineering', 4], ['3171916', 'Automobile Engineering', 4], ['3171917', 'Operations Research', 4], ['3171918', 'Mechatronics', 4], ['3171101', 'Project I', 4]],
    8: [['3181910', 'Additive Manufacturing', 4], ['3181913', 'Renewable Energy Systems', 4], ['3181915', 'Total Quality Management', 4], ['3181101', 'Project II', 8]],
  },
};

export const BRANCHES = [
  { code: 'CE', name: 'Computer Engineering' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'ME', name: 'Mechanical Engineering' },
];

export function subjectsFor(branch, semester) {
  const rows = semester <= 2 ? COMMON[semester] : (BRANCH_SUBJECTS[branch]?.[semester] ?? []);
  return rows.map(([code, name, credits]) => ({
    code, name, credits, branch, semester,
    hasLab: credits >= 4 && !/Project|Communication|Design Engineering/.test(name),
  }));
}

export const FACULTY = [
  ['Dr. Anjali Mehta', 'Computer Engineering', ['Database Management Systems', 'Data Mining & Warehousing', 'Big Data Analytics']],
  ['Prof. Rakesh Patel', 'Computer Engineering', ['Data Structures', 'Analysis & Design of Algorithms', 'Theory of Computation']],
  ['Dr. Sneha Desai', 'Computer Engineering', ['Operating Systems', 'System Programming', 'Distributed Systems']],
  ['Prof. Nikhil Joshi', 'Computer Engineering', ['Computer Networks', 'Computer Networks Fundamentals', 'Network Security', 'Information Security']],
  ['Dr. Priya Raval', 'Computer Engineering', ['Machine Learning', 'Artificial Intelligence', 'Natural Language Processing']],
  ['Prof. Kunal Shah', 'Information Technology', ['Object Oriented Programming with Java', 'Advanced Java Programming', 'Web Technology']],
  ['Dr. Meera Trivedi', 'Information Technology', ['Software Engineering', 'Design Engineering I', 'Mobile Application Development']],
  ['Prof. Harsh Vyas', 'Information Technology', ['Cloud Computing', 'Internet of Things', 'Blockchain Technology', 'Cyber Security']],
  ['Dr. Ritu Bhatt', 'Information Technology', ['Python for Data Science', 'Data Visualization', 'Compiler Design']],
  ['Prof. Devang Modi', 'Mechanical Engineering', ['Thermodynamics', 'Heat Transfer', 'Power Plant Engineering']],
  ['Dr. Kavita Nair', 'Mechanical Engineering', ['Fluid Mechanics', 'Refrigeration & Air Conditioning', 'Renewable Energy Systems']],
  ['Prof. Sanjay Rao', 'Mechanical Engineering', ['Machine Design I', 'Machine Design II', 'Strength of Materials', 'Kinematics of Machines']],
  ['Dr. Farhan Qureshi', 'Mechanical Engineering', ['Manufacturing Processes I', 'Manufacturing Processes II', 'Additive Manufacturing', 'Computer Aided Design']],
  ['Prof. Leena Pandya', 'Applied Sciences', ['Mathematics I', 'Mathematics II', 'Discrete Mathematics', 'Probability & Statistics']],
  ['Dr. Ashok Iyer', 'Applied Sciences', ['Physics', 'Chemistry', 'Basic Electronics', 'Digital Fundamentals', 'Digital Electronics']],
  ['Prof. Nidhi Gandhi', 'Applied Sciences', ['English & Communication Skills', 'Effective Technical Communication', 'Engineering Graphics & Design']],
  ['Dr. Bhavesh Solanki', 'Applied Sciences', ['Programming for Problem Solving', 'Basic Electrical Engineering', 'Engineering Mechanics']],
  ['Prof. Jignesh Amin', 'Computer Engineering', ['Computer Organisation & Architecture', 'Microprocessor & Interfacing', 'Project I', 'Project II']],
  ['Dr. Shraddha Dave', 'Mechanical Engineering', ['Industrial Engineering', 'Operations Research', 'Total Quality Management']],
  ['Prof. Amit Chauhan', 'Mechanical Engineering', ['Control Engineering', 'Mechatronics', 'Automobile Engineering']],
  ['Dr. Payal Thakkar', 'Mechanical Engineering', ['Internal Combustion Engines', 'Finite Element Methods', 'Dynamics of Machinery', 'Materials Science & Metallurgy']],
];

// A branch's subjects belong to that branch's department; the shared first-year
// subjects belong to Applied Sciences. Used to place anything the explicit lists
// above do not cover.
export const DEPARTMENT_OF_BRANCH = {
  CE: 'Computer Engineering',
  IT: 'Information Technology',
  ME: 'Mechanical Engineering',
};

export const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Aadhya', 'Kiara', 'Saanvi', 'Anika', 'Navya', 'Riya', 'Myra', 'Aarohi', 'Dhruv', 'Kabir', 'Rudra', 'Neel', 'Parth', 'Meera', 'Tanvi', 'Ishita', 'Khushi', 'Jiya', 'Manav', 'Yash', 'Harsh', 'Jay', 'Dev'];
export const LAST_NAMES = ['Patel', 'Shah', 'Desai', 'Mehta', 'Joshi', 'Trivedi', 'Raval', 'Vyas', 'Bhatt', 'Modi', 'Nair', 'Iyer', 'Pandya', 'Gandhi', 'Chauhan', 'Parmar', 'Solanki', 'Thakkar', 'Amin', 'Dave'];
