
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import CaseStudy, Question, Distractor, DomainTag

def seed_data():
    # Case Data (matching constants.tsx)
    case_data = {
        "id": "case-001",
        "title": "Community Integration Post-TBI",
        "setting": "Community Rehabilitation",
        "vignette": """Mr. Thompson is a 42-year-old male who sustained a moderate traumatic brain injury (TBI) six months ago following a motor vehicle accident. He was recently discharged from an inpatient rehabilitation unit and has returned to his two-story home, which he shares with his spouse and two teenage children. Prior to his injury, he worked as a senior software engineer.

Currently, Mr. Thompson presents with executive functioning deficits, specifically in multi-tasking and cognitive flexibility. He also experiences mild left-sided neglect and fatigue after 30 minutes of sustained attention. His spouse reports that he is "not himself," often becoming irritable during family dinners or when trying to manage household finances. Mr. Thompson expresses a strong desire to return to work, but he is struggling with basic instrumental activities of daily living (IADLs) like meal preparation and route finding in his local neighborhood. 

During an initial home visit, the OT observes Mr. Thompson attempting to boil water for tea while simultaneously trying to answer a text message. He forgets the stove is on until the kettle whistles persistently, causing him visible distress."""
    }

    # Create Case
    case, created = CaseStudy.objects.get_or_create(
        id=case_data["id"],
        defaults={
            "title": case_data["title"],
            "vignette": case_data["vignette"],
            "setting": case_data["setting"]
        }
    )
    if created:
        print(f"Created Case: {case.title}")
    else:
        print(f"Case already exists: {case.title}")

    # Questions Data
    questions = [
        {
            "id": "q-1",
            "stem": "Based on the initial observation of Mr. Thompson in his home, which assessment should the OT prioritize to evaluate his safety during IADLs?",
            "domain": DomainTag.OT_EXP,
            "correctLabel": "C",
            "correctRationale": "The Kettle Test is a top-down, functional assessment of complex IADLs that specifically evaluates executive function and safety in a familiar task, mirroring the exact breakdown observed.",
            "distractors": [
                {"label": "A", "text": "Montreal Cognitive Assessment (MoCA)", "rationale": "The MoCA is a screening tool, not a functional assessment of IADL safety."},
                {"label": "B", "text": "Assessment of Motor and Process Skills (AMPS)", "rationale": "While AMPS is excellent, it requires specific certification and may be more time-consuming than necessary for an initial safety screen."},
                {"label": "C", "text": "Kettle Test", "rationale": ""}, # Correct
                {"label": "D", "text": "Catherine Bergego Scale (CBS)", "rationale": "The CBS focuses on unilateral neglect; while relevant, cognitive safety in tasks is the more immediate functional priority."}
            ]
        },
        {
            "id": "q-2",
            "stem": "Mr. Thompson identifies as an Indigenous person and expresses concern that the \"Standardized Canadian Work Assessments\" do not reflect his community values or his role within his family. How should the OT proceed?",
            "domain": DomainTag.CEJ_JUSTICE,
            "correctLabel": "B",
            "correctRationale": "In alignment with the 2026 Blueprint on Cultural Safety, OTs must move beyond just noting bias; they must actively collaborate to modify or select assessments that respect Indigenous worldviews.",
            "distractors": [
                {"label": "A", "text": "Explain that the assessments are validated for all Canadians and necessary for insurance.", "rationale": "This dismisses the client's valid concerns and reinforces systemic bias."},
                {"label": "B", "text": "Collaborate with Mr. Thompson to integrate his cultural values and traditional occupations into the assessment process.", "rationale": ""},
                {"label": "C", "text": "Refer him to an Indigenous health liaison and postpone the work assessment.", "rationale": "While a liaison is helpful, the OT must still exercise clinical leadership and not \"pass off\" the responsibility for cultural safety."},
                {"label": "D", "text": "Use the assessments as written but add a footnote about his cultural background.", "rationale": "A footnote is a passive approach that does not fix the inherent mismatch in the assessment process."}
            ]
        },
        {
            "id": "q-3",
            "stem": "Mr. Thompson’s employer is hesitant to provide accommodations, citing the \"high-stakes\" nature of software engineering. What is the most effective advocacy role for the OT in this scenario?",
            "domain": DomainTag.COMM_COLLAB,
            "correctLabel": "C",
            "correctRationale": "Collaboration involves bridging the gap between clinical needs and employer requirements. A job-site analysis provides evidence-based data for reasonable accommodations.",
            "distractors": [
                {"label": "A", "text": "Advise Mr. Thompson to seek legal counsel for a human rights complaint.", "rationale": "This is premature and might damage the relationship with the employer."},
                {"label": "B", "text": "Provide the employer with a generic brochure on TBI recovery in the workplace.", "rationale": "Generic information is rarely effective for specific complex cognitive cases."},
                {"label": "C", "text": "Request a meeting with HR to present a job-site analysis and propose specific, incremental cognitive accommodations.", "rationale": ""},
                {"label": "D", "text": "Recommend that Mr. Thompson consider a career change to a less demanding field.", "rationale": "This is non-collaborative and gives up on the client's stated goal of returning to his chosen profession."}
            ]
        }
    ]

    for q_data in questions:
        question, q_created = Question.objects.get_or_create(
            id=q_data["id"],
            defaults={
                "case_study": case,
                "stem": q_data["stem"],
                "domain": q_data["domain"],
                "correct_label": q_data["correctLabel"],
                "correct_rationale": q_data["correctRationale"]
            }
        )
        if q_created:
            print(f"Created Question: {question.id}")
        
        # Distractors
        for d_data in q_data["distractors"]:
            Distractor.objects.get_or_create(
                question=question,
                label=d_data["label"],
                defaults={
                    "text": d_data["text"],
                    "incorrect_rationale": d_data["rationale"] or None
                }
            )

if __name__ == '__main__':
    try:
        seed_data()
        print("Seeding complete.")
    except Exception as e:
        print(f"Seeding failed: {e}")
