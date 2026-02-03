import { Link } from "react-router-dom";
import { FileSearch, Brain, Target, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import Layout from "../components/layout/Layout";
import FeatureCard from "../components/ui/FeatureCard";

const features = [
  {
    icon: FileSearch,
    title: "Resume Scoring",
    description:
      "Get an instant AI-powered score that tells you how well your resume matches job requirements.",
  },
  {
    icon: Brain,
    title: "Skill Extraction",
    description:
      "Our AI automatically extracts and categorizes your skills, experience, and qualifications.",
  },
  {
    icon: Target,
    title: "Job Matching",
    description:
      "Discover jobs that perfectly match your profile with personalized recommendations.",
  },
];

const benefits = [
  "Instant AI analysis in seconds",
  "Detailed skill gap insights",
  "Personalized job recommendations",
  "Industry-standard scoring",
  "Privacy-first approach",
  "ATS-friendly feedback",
];

const Home = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Zap className="w-4 h-4" />
              AI-Powered Resume Analysis
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
            >
              Get Hired Faster with{" "}
              <span className="text-gradient-primary">AI-Powered</span> Resume
              Insights
            </h1>

            <p
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
            >
              Upload your resume and let our AI analyze it against thousands of job
              requirements. Get instant feedback, skill insights, and personalized job
              recommendations.
            </p>

            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-in-up"
              style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
            >
              <Link to="/upload" className="btn-primary text-lg py-4 px-8 w-full sm:w-auto">
                Upload Resume
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#features" className="btn-secondary text-lg py-4 px-8 w-full sm:w-auto">
                View Features
              </a>
            </div>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
          >
            {[
              { value: "50K+", label: "Resumes Analyzed" },
              { value: "95%", label: "Accuracy Rate" },
              { value: "10K+", label: "Job Matches" },
              { value: "< 5s", label: "Analysis Time" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient-primary">
                  {stat.value}
                </p>
                <p className="text-muted-foreground text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 px-4 bg-card/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="section-title mb-4">Powerful AI Features</h2>
            <p className="section-subtitle mx-auto">
              Our advanced AI analyzes every aspect of your resume to give you
              actionable insights.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} delay={index * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="section-title mb-6">
                Why Choose <span className="text-gradient-primary">ResumeAI</span>?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Our platform combines cutting-edge AI technology with deep
                understanding of recruiting processes to help you stand out.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 opacity-0 animate-fade-in"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-elevated p-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                    <FileSearch className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Step 1</p>
                    <p className="text-muted-foreground text-sm">Upload your resume</p>
                  </div>
                </div>
                <div className="h-8 w-0.5 bg-border ml-6" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-accent flex items-center justify-center">
                    <Brain className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Step 2</p>
                    <p className="text-muted-foreground text-sm">AI analyzes your profile</p>
                  </div>
                </div>
                <div className="h-8 w-0.5 bg-border ml-6" />
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center">
                    <Target className="w-6 h-6 text-success-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Step 3</p>
                    <p className="text-muted-foreground text-sm">Get matched with jobs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="card-elevated p-10 md:p-14 text-center gradient-primary rounded-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to Land Your Dream Job?
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              Join thousands of job seekers who've improved their resumes and found
              better opportunities with ResumeAI.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-8 py-4 bg-card text-primary font-semibold rounded-xl hover:bg-card/90 transition-colors"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
