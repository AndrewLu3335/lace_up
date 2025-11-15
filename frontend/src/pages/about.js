import { Avatar, Box, Chip, Container, Grid, Typography, Divider } from '@mui/material';
import myphoto from '../assets/myphoto.jpg';

export default function About() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      {/* Avatar + Name */}
      <Box textAlign="center">
        <Avatar
          src={myphoto}
          sx={{
            width: 160,
            height: 160,
            margin: "0 auto",
            boxShadow: 4,
            border: "3px solid #fff"
          }}
        />
        <Typography variant="h4" fontWeight="bold" mt={3}>
          Andrew Lu
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Full-Stack Developer • Python • Django • React • PostgreSQL
        </Typography>
      </Box>

      {/* About Text */}
      <Box mt={6}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          About Me
        </Typography>
        <Typography variant="body1" lineHeight={1.7}>
          Hi! I'm <strong>Your Name</strong>, a full-stack developer with strong interest in backend systems,
          API design, and building clean, scalable applications. I enjoy working with Django, React, and PostgreSQL.
        </Typography>

        <Typography variant="body1" mt={2} lineHeight={1.7}>
          I love solving problems, designing elegant code architectures, and creating useful tools.
          I'm always learning and exploring new ideas in web development and software engineering.
        </Typography>
      </Box>

      {/* Skills */}
      <Box mt={6}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Skills
        </Typography>

        <Grid container spacing={2}>
          {[
            "Python",
            "Django",
            "React",
            "PostgreSQL",
            "REST API",
            "Material UI",
            "JavaScript",
            "Git / GitHub"
          ].map((skill) => (
            <Grid item key={skill}>
              <Chip
                label={skill}
                variant="outlined"
                color="primary"
                sx={{ fontSize: "0.95rem", px: 1.5 }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
      
      {/* GitHub Section */}
      <Divider sx={{ my: 6 }} />
      <Box textAlign="center">
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          GitHub
        </Typography>

        {/* GitHub Stats Card */}
        <Box mt={2}>
          <img
            src="https://camo.githubusercontent.com/703a5e9f6221437af2684e1f7ba4acce6498ebc55d83aa374c35d5435c6ebbe3/68747470733a2f2f6769746875622d726561646d652d73746174732e76657263656c2e6170702f6170693f757365726e616d653d616e647265776c752673686f775f69636f6e733d74727565267468656d653d7261646963616c"
            alt="GitHub Stats"
            style={{ maxWidth: "100%", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
          />
        </Box>

        {/* GitHub Button */}
        <Box mt={3}>
          <a
            href="https://github.com/AndrewLu3335"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              textDecoration: "none",
            }}
          >
            <Chip
              label="Visit My GitHub →"
              color="primary"
              variant="filled"
              sx={{ fontSize: "1rem", px: 3, py: 2 }}
            />
          </a>
        </Box>
      </Box>
      {/* Contact */}
      <Box mt={6} textAlign="center">
        <Typography variant="h6">
          Contact Me: <a href="jslu414@gmail.com">jslu414@gmail.com</a>
        </Typography>
      </Box>
    </Container>
  );
}