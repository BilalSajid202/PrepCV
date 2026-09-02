#!/usr/bin/env python3
"""
Quick test script for CV extraction with sample Rasikh CV data.
Run: python test_cv_extraction.py
"""

import sys
import json
from app.business_logic.cv_extractor import extract_raw_text_from_file, parse_cv_text_with_llm

# Sample raw text similar to what would be extracted from Rasikh's CV
SAMPLE_CV_TEXT = """
RASIKH ALI
Software Engineer - AI / Machine Learning Developer - Jr. Lecturer
+92 312-1472153 | rasikhali1234@gmail.com | Lahore, Pakistan

PROFESSIONAL SUMMARY
Gold Medalist Software Engineering graduate and AI/ML developer with hands-on experience building production chatbots, 
LLM/RAG pipelines, and full-stack Python applications.

PROFESSIONAL EXPERIENCE

OmniClouds | Artificial Intelligence Developer (Remote) Dec 2024 – Present
- Design and develop AI-driven software solutions, including LLM- and RAG-based applications, from prototype through deployment.
- Collaborate remotely with cross-functional teams to maintain and improve production applications, prioritizing performance and user experience.

Superior University | Junior Lecturer (Contractual) Nov 2023 – Present
- Deliver instruction and course support in software engineering and computer science subjects to undergraduate students.
- Design assessments and mentor students on programming, artificial intelligence, and software development fundamentals.

Bitlogicx | Machine Learning Engineer Apr 2023 – Jul 2024
- Built and maintained machine learning models and pipelines to solve real-world business problems, including computer vision and predictive analytics use cases.
- Applied strong analytical and problem-solving skills to improve model accuracy and delivery quality.

Superior University | Teacher Assistant Aug 2021 – Apr 2023
- Assisted faculty with instruction, grading, and lab supervision across Artificial Intelligence, Operating Systems, Database, and Mobile Application Development courses.

EDUCATION

Superior University Gold Campus, Lahore 2019 – 2023
BS, Software Engineering CGPA: 3.68 — Gold Medalist

LDA Model Boys High School, Lahore 2017 – 2019
Intermediate, Pre-Engineering

Govt. Pilot Secondary School, Lahore 2015 – 2017
Matriculation, Computer Science

CORE SKILLS
Technical Proficiencies: Python, JavaScript, FastAPI, Flask, SQL, PostgreSQL, MySQL, Redis, Git, Machine Learning, 
Deep Learning, LLMs, RAG, Data Analysis, HTML, CSS, Java, Go, FAISS, Computer Vision, Predictive Modeling, Bootstrap, 
jQuery, PHP, Firebase, MSSQL, XML, UML, Java Swing, Jupyter, VS Code, GitHub, Agile, OOP, Data Structures, Algorithms
"""


def test_fallback_parser():
    """Test the fallback CV parser with sample data."""
    print("=" * 70)
    print("Testing Fallback CV Parser")
    print("=" * 70)
    
    result = fallback_cv_parser(SAMPLE_CV_TEXT)
    
    print("\n--- PERSONAL INFO ---")
    personal = result.get("personal_info", {})
    print(f"Name: {personal.get('full_name')}")
    print(f"Title: {personal.get('professional_title')}")
    print(f"Email: {personal.get('email')}")
    print(f"Phone: {personal.get('phone')}")
    print(f"Location: {personal.get('location')}")
    
    print("\n--- EXPERIENCE ---")
    experiences = result.get("experience", [])
    print(f"Found {len(experiences)} experience entries:")
    for i, exp in enumerate(experiences, 1):
        print(f"\n  {i}. {exp.get('company')} | {exp.get('position')}")
        print(f"     Employment Type: {exp.get('employment_type')}")
        print(f"     Dates: {exp.get('start_date')} - {exp.get('end_date')}")
        print(f"     Current: {exp.get('is_current')}")
        achievements = exp.get("achievements", [])
        if achievements:
            print(f"     Achievements ({len(achievements)}):")
            for ach in achievements[:2]:  # Show first 2
                print(f"       - {ach[:60]}...")
    
    print("\n--- EDUCATION ---")
    education = result.get("education", [])
    print(f"Found {len(education)} education entries:")
    for i, edu in enumerate(education, 1):
        print(f"\n  {i}. {edu.get('institution')}")
        print(f"     Degree: {edu.get('degree')}")
        print(f"     Field: {edu.get('field_of_study')}")
        print(f"     Dates: {edu.get('start_date')} - {edu.get('end_date')}")
        print(f"     GPA: {edu.get('gpa')}")
    
    print("\n--- SKILLS ---")
    skills = result.get("skills", [])
    print(f"Found {len(skills)} skills: {', '.join(skills[:10])}")
    if len(skills) > 10:
        print(f"  ... and {len(skills) - 10} more")
    
    print("\n" + "=" * 70)
    print("Validation Results:")
    print("=" * 70)
    
    # Validation checks
    checks = {
        "Has name": bool(personal.get('full_name') and personal.get('full_name') != 'Candidate'),
        "Has title": bool(personal.get('professional_title')),
        "Has email": bool(personal.get('email')),
        "Has 4 experiences": len(experiences) == 4,
        "First company is OmniClouds": experiences[0].get('company', '').lower() == 'omniclouds' if experiences else False,
        "First position is AI Developer": 'ai' in experiences[0].get('position', '').lower() if experiences else False,
        "Has 3 education entries": len(education) == 3,
        "First degree is BS": 'bs' in education[0].get('degree', '').lower() if education else False,
        "Has CGPA": bool(education[0].get('gpa')) if education else False,
        "Has skills": len(skills) > 0,
        "Has Python skill": 'Python' in skills,
    }
    
    for check_name, passed in checks.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {check_name}")
    
    total = len(checks)
    passed = sum(1 for p in checks.values() if p)
    print(f"\nScore: {passed}/{total} ({100*passed//total}%)")
    
    return result


if __name__ == "__main__":
    result = test_fallback_parser()
    
    # Optionally save full result to JSON
    print("\n" + "=" * 70)
    print("Full JSON Output (first 1000 chars):")
    print("=" * 70)
    json_output = json.dumps(result, indent=2)
    print(json_output[:1000])
    if len(json_output) > 1000:
        print(f"... (truncated, total {len(json_output)} chars)")
